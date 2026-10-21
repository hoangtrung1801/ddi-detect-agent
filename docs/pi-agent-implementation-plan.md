# Implementation plan: DDI agent on Pi (TypeScript)

Replace the Python/LangGraph backend in `app/` with a TypeScript server built on
`pi-agent-core` + `pi-ai`. The new server lives in `server/` and is a drop-in
replacement for both clients (`frontend/` and `../ddisafe`).

## 1. Goals and non-goals

**Goals**
- Same HTTP contract as today for existing clients (`/query`, `/chat`, `/drug-name-extract/*`, `/medicine-cabinet/*`, `/health`, `/stats`), plus a typed `/v2` API with streaming.
- Safety status of every drug pair is decided by code from the database, never by the LLM.
- Roughly 3 agent turns per query (today about 20 LLM calls), no translation or re-parse pass.
- One language across server and clients; request and response schemas are shared.
- Deterministic, network-free unit tests; a golden evaluation set for the agent.

**Non-goals (this iteration)**
- Changing the interaction dataset or adding severity data.
- Authentication (keep `user_id` as today; tracked as follow-up).
- Horizontal scaling (single process, SQLite).

## 2. Locked decisions

| Topic | Decision |
|---|---|
| Runtime | Node >= 22.19 (pi requirement); developed on Node 26 |
| Language | TypeScript 7, `erasableSyntaxOnly`, run with Node native type stripping; `tsc --noEmit` for type checks only |
| Agent | `@earendil-works/pi-agent-core` 1.3.0, `@earendil-works/pi-ai` 1.3.0 (pin exact) |
| Schemas | `typebox` 1.x (the version pi uses), shared by tools, HTTP validation and clients |
| HTTP | `hono` 4.13 + `@hono/node-server` 2.x, SSE via `hono/streaming` |
| Storage | `better-sqlite3` 13: interaction DB (read-only) + app DB (sessions, cabinet, caches) |
| Embeddings | `@huggingface/transformers` 4.x, model `Xenova/all-MiniLM-L6-v2` (same weights as today) |
| LLM provider | OpenAI through pi-ai (`openai-responses` API); provider and model come from config |
| Web search | pi-ai does not provide it: a `web_search` tool wraps the `openai` SDK (7.x) Responses `web_search` tool |
| Tests | `vitest` 5 |
| Package manager | pnpm (already used by `frontend/`) |

## 3. Repository layout

```
server/
  package.json  tsconfig.json  vitest.config.ts  .env.example
  data/                       # generated, git-ignored
    ddi.sqlite                # drugs + interactions
    drug-vectors.f32          # 1701 x 384 float32, L2-normalised
    drug-names.json
  scripts/
    build-data.ts             # CSV -> ddi.sqlite + vectors (replaces GraphML + pickle)
    eval.ts                   # golden evaluation runner
    snapshot-python.ts        # records current Python /query outputs for comparison
  src/
    index.ts                  # boot: config, open DBs, warm embedder, start server
    config.ts                 # env parsing (TypeBox), model registry
    schemas/                  # TypeBox: domain, report, api v1, api v2
    domain/
      drug-db.ts              # pair lookup
      resolver.ts             # name -> DB drug with confidence
      links.ts                # drugs.com links
      risk.ts                 # overall risk computed in code
    llm/
      models.ts               # pi-ai registry + getModel helpers
      web-search.ts           # OpenAI Responses web_search wrapper
    agent/
      prompts.ts
      tools/ resolve-drugs.ts check-interactions.ts drug-links.ts submit-report.ts web-search.ts
      guard.ts                # beforeToolCall: enforce DB statuses on submit_report
      run.ts                  # per-request Agent factory, turn limit, timeout, event bridge
      ddi-agent.ts            # DDI query entry point -> InteractionReport
      chat-agent.ts           # follow-up chat with session memory
      extract-agent.ts        # label photo -> ingredient names
    store/
      app-db.ts               # migrations
      sessions.ts             # AgentMessage[] per session
      cabinet.ts
      cache.ts                # resolver + links cache
    http/
      app.ts                  # Hono app, middleware, error mapping
      sse.ts                  # agent events -> SSE
      routes/ v1-query.ts v1-chat.ts v1-extract.ts v1-cabinet.ts v1-system.ts v2.ts
      mappers/v1.ts           # InteractionReport -> legacy QueryResponse
  test/
    fixtures/ mini.csv golden.json
    unit/  agent/  http/
```

## 4. Data pipeline (`scripts/build-data.ts`)

Source: `db_drug_interactions.csv` (columns `drug_1,drug_2,condition`; 191,541 rows; 1,701 drugs).

1. Stream-parse the CSV.
2. `drugs(id INTEGER PK, name TEXT, name_norm TEXT UNIQUE)`, where `name_norm = trim(lower(name))`.
3. `interactions(a INTEGER, b INTEGER, src_a INTEGER, condition TEXT, PRIMARY KEY(a,b))`, stored with `a < b`. `src_a` keeps which drug the sentence names first, because the text is directional ("A may increase ... of B"). A duplicate pair overwrites the earlier row, which matches today's `add_interaction` behaviour.
4. Embed every `name` with transformers.js (`pooling: "mean", normalize: true`), write `drug-vectors.f32` + `drug-names.json`.
5. Print counts. The build fails unless there are 1,701 drugs and the expected number of edges, which must equal the igraph edge count (checked once against the Python graph in M0).

`pnpm data:build` runs it; `data/` is git-ignored. This removes the 94 MB pickle, the 34 MB GraphML and all Python from the runtime.

## 5. Domain layer (pure code, no LLM)

```ts
// drug-db.ts
getDrug(nameNorm: string): Drug | undefined
lookupPair(a: Drug, b: Drug): { condition: string; firstNamed: string } | null
stats(): { drugs: number; interactions: number }

// resolver.ts
resolve(input: string, genericGuess?: string): ResolvedDrug
// order: exact(input) -> exact(guess) -> alias table -> vector top-3 on guess ?? input
// ResolvedDrug = { input, generic, dbName | null, confidence, method: "exact"|"alias"|"vector"|"none", alternatives[] }
// confidence < RESOLVE_MIN (default 0.80) => dbName = null (unresolved)

// links.ts
link(dbName): { url, verified: boolean }   // slug + HEAD check, cached 30 days

// risk.ts
overallRisk(pairs): "high" | "medium" | "low" | "none" | "unknown"
// any unresolved/no_record and no interactions => "unknown"; no interactions and all resolved => "none";
// otherwise max of the LLM-assigned severity across "interaction" pairs
```

Key safety rule: `no_record` means "not in our database", not "safe".
All mappers and UI labels keep that distinction.

## 6. Agent design

### 6.1 Models (`llm/models.ts`)
`createModels()` + `openaiProvider()`. Config keys: `AGENT_MODEL`, `EXTRACT_MODEL` (vision), `CHAT_MODEL`, `REASONING_EFFORT`. M0 asserts that `model.input.includes("image")` for `EXTRACT_MODEL`.

### 6.2 Per-request agent (`agent/run.ts`)
- A new `Agent` for every request. Never share one across requests; this fixes today's shared-thread bug.
- `toolExecution: "parallel"`, so `check_interactions` and `drug_links` run together.
- Turn limit: count `turn_start` events, call `agent.abort()` after `MAX_TURNS` (default 6).
- Timeout: `AbortSignal.timeout(QUERY_TIMEOUT_MS)` wired to `agent.abort()`.
- `bridge(agent, sink)` turns `subscribe` events into a typed `ProgressEvent` stream (used by SSE and logs).
- Result: the `details` of the terminating `submit_report` call. If the loop ends without one, return a typed `AgentFailure`.

### 6.3 Tools (TypeBox parameters, results as `{ content, details }`)

| Tool | Params | Does | Notes |
|---|---|---|---|
| `resolve_drugs` | `{ drugs: { input, generic_guess }[] }` (1..10) | `resolver.resolve` for each | The LLM supplies the brand-to-generic guess, so this step needs no extra LLM call |
| `check_interactions` | `{ drugs: string[] }` (DB names, 2..10) | every unique pair -> `PairResult { a, b, status, condition }` | One call for all pairs; records results in the run context |
| `drug_links` | `{ drugs: string[] }` | `links.link` | Optional; failures do not fail the run |
| `submit_report` | `InteractionReport` | validate + return | `terminate: true` |

### 6.4 Guard (`agent/guard.ts`, `beforeToolCall`)
For `submit_report`:
1. Reject when `check_interactions` has not run in this request. The thrown error goes back to the model.
2. Overwrite each pair's `status` and `db_condition` with the recorded `PairResult`, add any pair the model skipped (`explanation` set to a fixed Vietnamese template), and drop pairs that don't exist.
3. Overwrite `overall_risk` with `risk.overallRisk(...)`.
4. Attach `drugs` from the recorded resolver output.

The LLM only contributes text (explanations, severity, recommendations, title).

### 6.5 Report schema (`schemas/report.ts`)
```ts
InteractionReport = {
  title: string,                         // vi
  drugs: ResolvedDrug[],
  pairs: { a, b, status: "interaction"|"no_record"|"unresolved",
           severity?: "major"|"moderate"|"minor", db_condition?: string,
           explanation: string }[],      // vi
  overall_risk: "high"|"medium"|"low"|"none"|"unknown",
  recommendations: string[],             // vi
  links: Record<string, { url: string; verified: boolean }>,
  disclaimer: string                     // fixed vi text, set by code
}
```

### 6.6 Prompts (`agent/prompts.ts`)
Short and procedural: call `resolve_drugs`, then `check_interactions` (+ `drug_links`), then `submit_report` in Vietnamese. Never call a pair safe unless its status is `interaction`-free and resolved. Explain only from `db_condition` plus general pharmacology, and label general knowledge as such. Keep the prompt under about 40 lines; examples live in tests, not in the prompt.

### 6.7 Chat agent (`agent/chat-agent.ts`)
- Same tools minus `submit_report`, plus `web_search`. Free-text answer in Vietnamese.
- Session memory: load `AgentMessage[]` for `session_id` from SQLite into `agent.state.messages`, then save after `agent_end`. Trim to the last N turns before saving.
- When a session has a previous report, its JSON is added once as context. This replaces the shared `"hackathon"` key.

### 6.8 Label extraction (`agent/extract-agent.ts`)
Single `models.complete` call (no loop) with a base64 image and a `submit_ingredients` schema. The request is validated with `validateToolCall`. No Cloudinary: the upload is read into memory (max 8 MB, image MIME types only). `POST /drug-name-extract` keeps accepting `image_url` (http(s) or data URL).

## 7. HTTP API

### 7.1 v1 (compatibility, same shapes as today)
| Route | Implementation |
|---|---|
| `POST /query` | DDI agent; `mappers/v1.ts` -> `{ answer, drug_links, parsed_result }` |
| `POST /chat` | chat agent; honours `session_id` (generates one when absent) |
| `DELETE /chat/:session_id` | delete session rows |
| `POST /drug-name-extract`, `POST /drug-name-extract/upload` | extract agent |
| `/medicine-cabinet/*` | `store/cabinet.ts` + resolver + drug-db; no agent |
| `GET /health`, `GET /stats` | `/stats` returns the backend field names (frontend type fixed separately) |
| `POST /query-translate` | removed (always failed); returns 410 |

v1 mapping: `answer` is markdown rendered from the report. `parsed_result.interactions[].status` maps `interaction` -> `"Có Tương Tác"`, `no_record` -> `"Không có dữ liệu"`, `unresolved` -> `"Không xác định"`. `drug_conversion` comes from `drugs[]`.

**Required client patch (in M3):** `ddisafe` `InteractionResults.tsx:166` treats any status other than `"Có Tương Tác"` as safe. Add a neutral "unknown" badge for the two new statuses so they never show as safe.

### 7.2 v2
- `POST /v2/interactions` `{ drugs: string[] } | { text: string }` -> `InteractionReport`
- `POST /v2/interactions/stream` -> SSE: `progress` (tool start/end, resolved drugs, pair results), `report`, `error`
- `POST /v2/chat`, `GET /v2/sessions/:id`
- Errors: `{ error: { code, message } }`, with codes `VALIDATION`, `AGENT_TIMEOUT`, `AGENT_NO_REPORT`, `UPSTREAM_LLM`, `NOT_FOUND`

## 8. Persistence (`store/app-db.ts`, file `APP_DB_PATH`)

```
sessions(id TEXT PK, created_at, updated_at, last_report_json TEXT)
session_messages(session_id, seq, message_json, PRIMARY KEY(session_id, seq))
cabinet_drugs(user_id, db_name, input_name, added_at, PRIMARY KEY(user_id, db_name))
cabinet_pairs(user_id, a, b, status, condition, checked_at, PRIMARY KEY(user_id, a, b))
cache(kind, key, value_json, expires_at, PRIMARY KEY(kind, key))
```
Migrations run in order at boot (`PRAGMA user_version`). Cabinet keys are always resolved DB names, which fixes the add/has/remove bug. Pair checks run synchronously at add time because they are pure lookups.

## 9. Config (`.env`)

`OPENAI_API_KEY`, `AGENT_MODEL`, `CHAT_MODEL`, `EXTRACT_MODEL`, `REASONING_EFFORT`, `PORT=8000`, `CORS_ORIGINS` (explicit list), `DDI_DB_PATH`, `VECTORS_PATH`, `APP_DB_PATH`, `RESOLVE_MIN=0.80`, `MAX_TURNS=6`, `QUERY_TIMEOUT_MS=60000`, `LOG_LEVEL`. Validated with TypeBox at boot; the server fails fast when a value is invalid.

## 10. Observability
- Structured JSON logs (`pino`) with a request id and the agent run id; one log line per tool execution with its duration.
- Per run: turns, tool calls, token usage (from assistant message usage), latency.
- Optional OpenTelemetry export later; not in scope for cutover.

## 11. Testing strategy
- **Unit:** drug-db, resolver (exact, vector, threshold, alternatives), risk, mappers, guard. All run on `test/fixtures/mini.csv`, built in memory, with no network.
- **Agent:** inject a scripted `streamFn` into `Agent`. Cover the happy path, a skipped pair, the model claiming "safe" for `no_record`, a missing `submit_report`, an invalid schema followed by a retry, and timeout/abort.
- **HTTP:** Hono `app.request()` contract tests for every v1 route against JSON fixtures recorded from the Python API.
- **Golden eval (`pnpm eval`, real LLM, not in CI by default):** about 25 cases covering brand names, misspellings, an unknown drug, 2–5 drug lists, Vietnamese input and supplements. Checks resolved names, pair statuses (exact match) and schema validity, and reports latency and token cost. Compared with the Python snapshot.

## 12. Milestones

Each milestone ends with the stated checks passing.

**M0: spike and baseline (1 day)**
- [x] Scaffold `server/` (pnpm, tsconfig, vitest, scripts).
- [x] Hello-agent: pi `Agent` + OpenAI + one tool + `terminate: true` returning structured `details`.
- [x] Confirm the `streamFn` shape for scripted tests.
- [x] Embedding parity: top-1 match of transformers.js vs. Python on 50 names (target >= 49/50).
- [ ] Record the Python `/query` and cabinet outputs on golden inputs (`scripts/snapshot-python.ts`). **Script written, not run**: the Python env cannot start (fastapi, numpy not installed); contract fixtures were built from the Python response models instead (see 15).
- Exit: a go/no-go note added to this file.

**M1: data and domain (1–2 days)**
- [x] `build-data.ts` + count checks.
- [x] `drug-db`, `resolver`, `links`, `risk` + unit tests.
- [x] Alias table seed (common brands: Tylenol, Advil, Coumadin, Panadol, ...).
- Exit: unit tests green; resolver matches the snapshot on all golden names.

**M2: DDI agent (2 days)**
- [x] Tools, guard, prompts, `run.ts` (turn limit, timeout, event bridge).
- [x] Scripted agent tests.
- [x] `pnpm eval`.
- Exit: 100% pair-status agreement with the DB on golden cases; no `no_record` or `unresolved` pair ever shown as safe; median latency and tokens recorded.

**M3: HTTP v1 compatibility + v2 (1–2 days)**
- [x] Hono app, CORS, error mapping, request validation.
- [x] v1 routes + mappers + contract tests.
- [x] v2 + SSE.
- [x] ddisafe status patch; `frontend/` `StatsResponse` type fix.
- Exit: both clients work against `server/` with only the dev proxy target changed.

**M4: chat, extraction, cabinet (1–2 days)**
- [x] App DB + migrations, sessions, chat agent + `web_search` tool.
- [x] Extract agent (upload + URL), no Cloudinary.
- [x] Cabinet routes on the new store.
- Exit: contract tests green; chat keeps context per session; cabinet add/remove/list correct for brand names.

**M5: cutover and cleanup (0.5–1 day)**
- [ ] Point both clients' proxies at `server/`; run the full golden eval once more.
- [ ] Delete `app/`, the root Python scripts, the `*_COMPLETE.md`/`*_SUMMARY.md` docs, the GraphML, the pickle and the PNGs (git history keeps them).
- [ ] Update the README run instructions.

Estimated total: 7–10 working days.

## 13. Risks

| Risk | Mitigation |
|---|---|
| pi APIs change quickly (scope already moved once) | Pin exact versions; keep all pi usage behind `agent/run.ts` and `llm/models.ts` |
| Embedding mismatch between transformers.js and Python | Parity check in M0; alias table for common brands; threshold tuned on the golden set |
| Model skips tools or loops | Guard, turn limit, timeout, `AGENT_NO_REPORT` error |
| drugs.com blocks HEAD checks | Return unverified slug links; cache; links are optional |
| ddisafe shows unknown pairs as safe | Client patch in M3 is required before cutover |
| Data accuracy (no severity in dataset) | Severity labelled as model-assigned in UI; disclaimer set by code |

## 14. Follow-ups (out of scope)
Authentication and real user ids; Postgres when running more than one instance; severity data source; OpenTelemetry; moving shared schemas into a workspace package consumed by both clients.

## 15. Implementation log

Scope of this run: M0 through M4. M5 (cutover, deletion of `app/` and Python assets, README) is **not done**.

### 15.1 M0 go/no-go: GO

- **Scaffold**: `server/` with pnpm, TS 7 (`erasableSyntaxOnly`, native type stripping, `tsc --noEmit`), vitest 5. Pinned `typebox` to 1.3.27 (what pi-agent-core depends on; the earlier scaffold had 1.4.2, which gave two typebox copies), added `pnpm.onlyBuiltDependencies` (better-sqlite3, sharp, onnxruntime-node, esbuild). `better-sqlite3` loads fine on Node 26.
- **Hello agent** (`scripts/spike-agent.ts`, real LLM): pi `Agent` + `openaiProvider()` + one tool with `terminate: true` ends after 1 turn, structured `details` arrive on the `toolResult` message and in `tool_execution_end`. `EXTRACT_MODEL` supports image input (`model.input.includes("image")`).
- **Model access**: the API key has no access to `gpt-5-mini` (403 `model_not_found`). Accessible: `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.5`, `gpt-4o`, `gpt-4o-mini`, `gpt-6-luna`, ... All defaults now use `gpt-5.4-mini` (in pi's catalog, vision capable, reasoning).
- **Scripted streamFn**: no hand-written stream needed. `fauxProvider()` from `@earendil-works/pi-ai` is registered with `createModels().setProvider(faux.provider)`; `faux.setResponses([fauxAssistantMessage(...)])` (response steps may be async factories that receive the transcript context). Agent tests use it with `models.streamSimple.bind(models)` exactly as in production.
- **Embedding parity** (`scripts/spike-parity.ts`): Python could not be run (no numpy/sentence-transformers in the system Python), so the fallback method was used: transformers.js embeddings of 50 evenly spaced drug names (lower-cased) compared with the Python-generated `drug_embeddings_embeddings.npy` (parsed in Node). Result: **50/50 top-1, min cosine to the Python vector 1.00000** (the weights are identical).
- **Edge count check**: the CSV has 191,541 rows, 1,701 drugs, **191,135** unique undirected pairs (no self loops). The legacy `drug_interactions.graphml` has 1,702 nodes and 191,136 edges; the only difference is a stale extra `Alcohol`-`Acetaminophen` edge (and node) that is not in the CSV. The build therefore checks 191,135 against the CSV; the plan's "must equal the igraph edge count" was not applicable because the GraphML is stale.
- **Python snapshot**: not recorded (fastapi, numpy, langgraph missing; the flow also needs paid LLM calls). `scripts/snapshot-python.ts` is written and can be run later with `PY_BASE_URL=... pnpm snapshot:python`. HTTP contract tests use TypeBox shapes copied from `app/models/responses.py` and `app/agents/models.py` (`test/helpers/contract.ts`).

### 15.2 Results

- `pnpm data:build`: 191,541 rows, 1,701 drugs, 191,135 interactions, 1,701 x 384 vectors, drug names identical to `drug_embeddings_mapping.json`; ~2 s.
- Unit + agent + HTTP tests: 63 passing, no network, no model download (stub embedder, `mini.csv`, faux provider).
- `pnpm eval` (26 golden cases, `gpt-5.4-mini`, reasoning low, real LLM): **26/26 cases pass, pair-status agreement 42/42 = 100%, 0 pairs shown without the unknown wording, 26/26 schema-valid; median latency 4.97 s (p90 6.90 s); median 3 turns; median 3,133 tokens/query; 91,497 tokens and $0.104 for the whole set.** (An earlier run, before two prompt/tool fixes below, had 25/26.)
- M1 resolver gate (`scripts/check-resolver.ts`, real embeddings, no LLM, no generic guess): 57/58 golden inputs resolve to the expected DB name. The one miss is the misspelling `ibuprofin` (cosine 0.61 < 0.80, safely left unresolved); in the agent flow the LLM supplies `generic_guess` and the case passes. Unknown items (St John's wort, insulin, fish oil, made-up names) are correctly unresolved.
- Real-LLM smoke on the booted server: `/health`, `/stats` (1701 / 191135), `/query` (6 s, 3 turns), `/chat` x3 on one session (history and the earlier `/query` report both used, `web_search` used), `/drug-name-extract` and `/upload` with a generated label image (-> Paracetamol, Caffeine), cabinet add/list/remove/clear with brand names, `/v2/interactions/stream`.

### 15.3 Deviations from the plan

1. **`check_interactions` accepts 0..10 names** (plan: 2..10). It always checks every pair among all drugs of the request, including unresolved ones (status `unresolved`). With a 2-name minimum the model could not complete a request in which one or both drugs were unresolved (found in eval: 0/2 and 1/2 resolvable cases ended without a report).
2. **`submit_report` takes a draft** (`title`, `pairs[{a,b,severity?,explanation}]`, `recommendations`), not the full `InteractionReport`. Statuses, DB conditions, drugs, links, overall risk and the disclaimer are filled in by code. The guard is split: `beforeToolCall` blocks `submit_report` until `check_interactions` has run; the merge itself (`buildReport` in `agent/guard.ts`) runs inside the tool because `beforeToolCall` cannot rewrite arguments. Explanations for `no_record`/`unresolved` pairs are fixed Vietnamese templates; model text is appended only as a labelled general-knowledge note and only if it does not claim safety.
3. **`overall_risk`**: literal reading of the plan rule. Any `interaction` -> max model-assigned severity (missing = medium); no interaction but some `no_record`/`unresolved` pair -> `unknown`; `none` only when there are no pairs to flag. So two resolved drugs with no recorded interaction give `unknown`, not `none` (consistent with "no_record is not safe"). Open question: whether the UI wants `none` there.
4. **Links**: `submit_report` fills in drugs.com links for all resolved drugs (cached, parallel, HEAD with 4 s timeout) even if the model skipped `drug_links`, so the v1 `drug_links` field is always populated.
5. **Resolver is async** (embedding is async) and also cleans dose text/brackets before matching; the alias table is in `src/domain/aliases.ts` (about 70 brands/synonyms, targets verified against the real DB by a test). `Aspirin` maps to `Acetylsalicylic acid` (there is no `Aspirin` row).
6. **Default models**: `gpt-5.4-mini` for agent, chat, extract and web search (see 15.1). The Python default `gpt-5-mini-2025-08-07` is not available to this key.
7. **Legacy chat context**: v1 `/query` has no session id and the ddisafe chatbot sends a hard-coded `session_id`, so `/query` stores its report in an anonymous `default` session slot and `/chat` falls back to it when its own session has no report. `/query` also accepts an optional `session_id` (superset) to bind the report to a session. This keeps both clients working with only the proxy changed; it is single-user behaviour for legacy clients only. `/stats.active_sessions` excludes the anonymous slot.
8. **v1 cabinet**: names that do not match the DB return 200 with `success:false` (not added). `drug_name` in responses is the canonical DB name. `checking_interactions` is true when there were existing drugs (the checks are synchronous, so results are already in `/list`).
9. **v1 errors** keep FastAPI's `{detail}`: validation 422 with a `detail` array, agent failures 500 (504 on timeout). v2 uses `{error:{code,message}}` (VALIDATION 400, AGENT_TIMEOUT 504, AGENT_NO_REPORT 502, UPSTREAM_LLM 502, NOT_FOUND 404); unexpected internal errors in v2 also use `UPSTREAM_LLM` because the plan's code list has no internal-error code.
10. **Extraction** loads `image_url` server-side (needed because pi image content is base64): http(s) only, no redirects, private/loopback addresses blocked, 8 MB cap, image MIME types only. Not in the plan; added as an SSRF guard. The model call has no reasoning-steps output (Python returned only names anyway).
11. Added `pino` 10.4.0 (plan section 10 names pino but it was not in the scaffold) and `src/env.ts` (loads `server/.env` then repo-root `.env`).
12. Client patches: `../ddisafe/src/components/InteractionResults.tsx` now shows a neutral `Info` badge with the status text for `Không có dữ liệu`/`Không xác định` (and the header becomes the neutral "Thông Tin Tương Tác" instead of "Không Tìm Thấy Tương Tác" when the only non-interaction pairs are unknown); `frontend/src/lib/api.ts` `StatsResponse` fields renamed to `total_drugs`, `total_interactions`, `active_sessions`. Both clients still build.

### 15.4 Open items

- M5 not started; `app/`, Python scripts, docs, GraphML, pickle and PNGs are untouched. The clients' dev proxies still point at `localhost:8000`, which is also the new server's default port.
- Python `/query` snapshot not recorded (see 15.1); parity of answer content with the old agent is therefore not compared, only status agreement against the CSV.
- Vector-only resolution of misspellings without a generic guess is weak (0.61 for `ibuprofin`); consider an edit-distance fallback if unguided inputs (cabinet add) matter.
- Severity is model-assigned and not in the dataset; the disclaimer says so.
- Auth, sessions per real user, and `user_id` trust are unchanged (follow-ups in section 14).
- M3 exit ("both clients work against `server/`") was verified only by client builds plus curl against the same routes and shapes; the UIs were not opened in a browser.
