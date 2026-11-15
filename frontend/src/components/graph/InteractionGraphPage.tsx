import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  Expand,
  Shrink,
  EyeOff,
  Filter,
  Loader2,
  Maximize,
  Minimize,
  Plus,
  RotateCcw,
  Scan,
  Search,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { v2API, type GraphLink, type GraphSeverity } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SEVERITIES, sevOf, sevRank } from "./severity";
import { Graph3D, pairKey, type GraphHandle, type LabelMode } from "./Graph3D";

const MAX_SEEDS = 10;
const NEIGHBOR_STEPS = [0, 10, 25, 50];
const LIST_STEP = 40;
const norm = (s: string) => s.trim().toLowerCase();

type Scope = "all" | "seeds" | "between";
const SCOPES: { id: Scope; label: string; hint: string }[] = [
  { id: "all", label: "Tất cả cặp", hint: "Mọi tương tác giữa các thuốc đang hiển thị" },
  { id: "seeds", label: "Chỉ cặp có thuốc đã chọn", hint: "Ẩn tương tác giữa các thuốc lân cận với nhau" },
  { id: "between", label: "Chỉ giữa thuốc đã chọn", hint: "Đúng các cặp trong danh sách thuốc của bạn" },
];
const LABEL_MODES: { id: LabelMode; label: string }[] = [
  { id: "auto", label: "Nhãn: tự động" },
  { id: "all", label: "Nhãn: tất cả" },
  { id: "none", label: "Nhãn: chỉ khi chọn" },
];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function download(name: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}

interface InteractionGraphPageProps {
  /** Drugs to start with; with none, the page opens on the database's most-connected drugs. */
  initialDrugs?: string[];
  /** An interaction to open once the graph loads (e.g. the pair a result card linked from). */
  initialPair?: [string, string];
  /** Neighbours per drug to start with; 0 shows only the given drugs (the pairs of a result). */
  initialNeighbors?: number;
  onCheckDrugs?: (drugs: string[]) => void;
}

export function InteractionGraphPage({ initialDrugs, initialPair, initialNeighbors, onCheckDrugs }: InteractionGraphPageProps) {
  const [seeds, setSeeds] = useState<string[]>(() => [...new Set(initialDrugs ?? [])].slice(0, MAX_SEEDS));
  const [neighbors, setNeighbors] = useState(initialNeighbors ?? (initialPair ? 10 : 25));
  const [hiddenSev, setHiddenSev] = useState<Set<GraphSeverity>>(() => new Set());
  const [scope, setScope] = useState<Scope>("all");
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(() => new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [labels, setLabels] = useState<LabelMode>("auto");
  const [dims, setDims] = useState<2 | 3>(3);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  // Wide: the side panels go away and the graph takes the whole page; details float over it.
  const [wide, setWide] = useState(false);
  const [listLimit, setListLimit] = useState(LIST_STEP);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [findQ, setFindQ] = useState("");
  const [partnerQ, setPartnerQ] = useState("");
  const [partnerSev, setPartnerSev] = useState<GraphSeverity | "all">("all");
  const dq = useDebounced(q.trim(), 200);
  const dfq = useDebounced(findQ.trim(), 200);
  const graphRef = useRef<GraphHandle>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const findRef = useRef<HTMLInputElement>(null);

  const graph = useQuery({
    queryKey: ["graph", seeds, neighbors],
    queryFn: ({ signal }) => v2API.graph(seeds, neighbors, signal),
    placeholderData: (prev) => prev,
  });
  const suggestions = useQuery({
    queryKey: ["drug-search", dq],
    queryFn: ({ signal }) => v2API.searchDrugs(dq, signal),
    enabled: dq.length >= 2,
  });
  const findSuggest = useQuery({
    queryKey: ["drug-search", dfq],
    queryFn: ({ signal }) => v2API.searchDrugs(dfq, signal),
    enabled: dfq.length >= 2,
  });
  const [pairA, pairB] = selectedPair ? (selectedPair.split("|") as [string, string]) : [];
  const pairDetail = useQuery({
    queryKey: ["graph-pair", selectedPair],
    queryFn: ({ signal }) => v2API.graphPair(pairA!, pairB!, signal),
    enabled: !!selectedPair,
    staleTime: Infinity,
  });

  const data = graph.data;
  const userSeeds = seeds.length > 0;

  const nodes = useMemo(() => (data?.nodes ?? []).filter((n) => !hiddenNodes.has(n.id)), [data, hiddenNodes]);
  const seedSet = useMemo(() => new Set(nodes.filter((n) => n.seed).map((n) => n.id)), [nodes]);
  const scoped = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    return (data?.links ?? []).filter((l) => {
      if (!ids.has(l.source) || !ids.has(l.target)) return false;
      if (!userSeeds || scope === "all") return true;
      const a = seedSet.has(l.source);
      const b = seedSet.has(l.target);
      return scope === "seeds" ? a || b : a && b;
    });
  }, [data, nodes, seedSet, scope, userSeeds]);
  const counts = useMemo(() => {
    const c = new Map<GraphSeverity, number>();
    for (const l of scoped) c.set(l.severity, (c.get(l.severity) ?? 0) + 1);
    return c;
  }, [scoped]);
  const shown = useMemo(() => scoped.filter((l) => !hiddenSev.has(l.severity)), [scoped, hiddenSev]);
  const sorted = useMemo(() => {
    const seedScore = (l: GraphLink) => -(Number(seedSet.has(l.source)) + Number(seedSet.has(l.target)));
    return [...shown].sort(
      (x, y) => sevRank(x.severity) - sevRank(y.severity) || seedScore(x) - seedScore(y) || x.source.localeCompare(y.source),
    );
  }, [shown, seedSet]);
  const seedMajor = useMemo(
    () => (userSeeds && seedSet.size > 1 ? (data?.links ?? []).filter((l) => l.severity === "major" && seedSet.has(l.source) && seedSet.has(l.target)).length : 0),
    [data, seedSet, userSeeds],
  );

  const nodeInfo = useMemo(() => {
    if (!selectedNode) return null;
    const node = nodes.find((n) => n.id === selectedNode);
    if (!node) return null;
    const partners = scoped
      .filter((l) => l.source === selectedNode || l.target === selectedNode)
      .map((l) => ({ name: l.source === selectedNode ? l.target : l.source, severity: l.severity }))
      .sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || a.name.localeCompare(b.name));
    const by = new Map<GraphSeverity, number>();
    for (const p of partners) by.set(p.severity, (by.get(p.severity) ?? 0) + 1);
    return { node, partners, by };
  }, [selectedNode, nodes, scoped]);

  const selectedLink = useMemo(
    () => (selectedPair ? (data?.links ?? []).find((l) => pairKey(l.source, l.target) === selectedPair) ?? null : null),
    [selectedPair, data],
  );

  // Open the pair a result card linked from, once its graph has loaded.
  const pendingPair = useRef(initialPair);
  useEffect(() => {
    if (!data || !pendingPair.current) return;
    const toDb = (s: string) => norm(data.resolved.find((r) => norm(r.input) === norm(s))?.name ?? s);
    const [a, b] = pendingPair.current.map(toDb);
    pendingPair.current = undefined;
    const l = data.links.find((x) => (norm(x.source) === a && norm(x.target) === b) || (norm(x.source) === b && norm(x.target) === a));
    if (l) setSelectedPair(pairKey(l.source, l.target));
  }, [data]);

  const clearSelection = () => {
    setSelectedNode(null);
    setSelectedPair(null);
  };
  const selectNode = (id: string) => {
    setSelectedPair(null);
    setSelectedNode(id);
    setPartnerQ("");
    setPartnerSev("all");
  };
  const selectPair = (a: string, b: string) => {
    setSelectedNode(null);
    setSelectedPair(pairKey(a, b));
  };

  const addSeed = (name: string) => {
    setQ("");
    setFindQ("");
    setOpen(false);
    clearSelection();
    setListLimit(LIST_STEP);
    setSeeds((prev) => (prev.length >= MAX_SEEDS || prev.some((s) => norm(s) === norm(name)) ? prev : [...prev, name]));
  };
  const removeSeed = (name: string) => {
    clearSelection();
    setSeeds((prev) => prev.filter((s) => s !== name));
  };
  const toggleSev = (id: GraphSeverity) =>
    setHiddenSev((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const onlyMajor = hiddenSev.size === 3 && !hiddenSev.has("major");

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === boxRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "Escape" && !typing) clearSelection();
      if (e.key === "/" && !typing) {
        e.preventDefault();
        findRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void boxRef.current?.requestFullscreen?.();
  };
  const saveImage = () => {
    const url = graphRef.current?.screenshot();
    if (url) download("do-thi-tuong-tac.png", url);
  };
  const saveCsv = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = ["drug_a,drug_b,severity", ...sorted.map((l) => [l.source, l.target, l.severity].map(esc).join(","))];
    const url = URL.createObjectURL(new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" }));
    download("cap-tuong-tac.csv", url);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const findHits = useMemo(() => {
    const k = norm(findQ);
    if (!k) return [];
    return nodes
      .filter((n) => norm(n.id).includes(k))
      .sort((a, b) => Number(!norm(a.id).startsWith(k)) - Number(!norm(b.id).startsWith(k)) || b.degree - a.degree)
      .slice(0, 6);
  }, [findQ, nodes]);
  // Database drugs matching the find box that are not in the graph yet: one click adds them.
  const addHits = useMemo(() => {
    if (seeds.length >= MAX_SEEDS || dfq.length < 2 || dfq !== findQ.trim()) return [];
    const inGraph = new Set(nodes.map((n) => norm(n.id)));
    return (findSuggest.data ?? []).filter((s) => !inGraph.has(norm(s.name))).slice(0, 4);
  }, [findSuggest.data, nodes, seeds.length, dfq, findQ]);
  const flyToNode = (id: string) => {
    setFindQ("");
    selectNode(id);
    graphRef.current?.flyTo(id);
  };

  const partners = useMemo(() => {
    if (!nodeInfo) return [];
    const k = norm(partnerQ);
    return nodeInfo.partners.filter(
      (p) => (partnerSev === "all" || p.severity === partnerSev) && (!k || norm(p.name).includes(k)),
    );
  }, [nodeInfo, partnerQ, partnerSev]);

  const hasDetail = !!(selectedLink || nodeInfo);

  // The graph box changes size with the layout; refit once it has.
  useEffect(() => {
    const t = [350, 1600].map((ms) => setTimeout(() => graphRef.current?.zoomToFit(), ms));
    return () => t.forEach(clearTimeout);
  }, [wide, filtersOpen]);

  const searchPanel = (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <label htmlFor="graph-search" className="text-sm font-semibold">
          Thuốc trung tâm
        </label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {seeds.length}/{MAX_SEEDS}
        </span>
      </div>
      <div className="relative mt-2">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="graph-search"
          value={q}
          autoComplete="off"
          placeholder="Thêm thuốc: Warfarin, Panadol…"
          className="h-11 pl-9"
          disabled={seeds.length >= MAX_SEEDS}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) addSeed(suggestions.data?.[0]?.name ?? q.trim());
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {open && dq.length >= 2 && (
          <ul role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover py-1 shadow-lg">
            {suggestions.data?.length ? (
              suggestions.data.map((s) => (
                <li key={s.name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addSeed(s.name)}
                    className="flex min-h-10 w-full items-center justify-between gap-3 px-3 text-left text-sm hover:bg-muted"
                  >
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{s.degree.toLocaleString("vi-VN")} tương tác</span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {suggestions.isFetching ? "Đang tìm…" : "Không thấy trong CSDL — nhấn Enter để thử tên khác (biệt dược, tên Việt)."}
              </li>
            )}
          </ul>
        )}
      </div>

      {seeds.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {seeds.map((s) => {
            const r = data?.resolved.find((x) => x.input === s);
            const missing = data?.unresolved.includes(s);
            return (
              <li key={s}>
                <span
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm font-semibold",
                    missing ? "border-dashed border-sev-major text-sev-major" : "border-primary/40 bg-brand-soft text-brand-ink",
                  )}
                  title={missing ? "Không tìm thấy trong cơ sở dữ liệu" : r && r.name !== s ? `Khớp với ${r.name}` : undefined}
                >
                  {r && r.name !== s ? `${s} → ${r.name}` : s}
                  <button
                    type="button"
                    onClick={() => removeSeed(s)}
                    aria-label={`Bỏ ${s}`}
                    className="flex size-7 items-center justify-center rounded-full hover:bg-background/70"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {userSeeds && (
        <div className="mt-4">
          <span className="text-sm font-semibold">Thuốc lân cận mỗi thuốc</span>
          <div className="mt-2 grid grid-cols-4 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Số thuốc lân cận mỗi thuốc">
            {NEIGHBOR_STEPS.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={neighbors === n}
                onClick={() => setNeighbors(n)}
                className={cn(
                  "min-h-9 rounded-md text-sm font-semibold tabular-nums transition-colors",
                  neighbors === n ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {n === 0 ? "Không" : n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {seeds.length >= 2 && onCheckDrugs && (
          <Button className="h-10 font-semibold" onClick={() => onCheckDrugs(data?.resolved.map((r) => r.name) ?? seeds)}>
            <Sparkles className="size-4" /> Phân tích {seeds.length} thuốc bằng AI
          </Button>
        )}
        {userSeeds && (
          <Button
            variant="outline"
            className="h-10"
            onClick={() => {
              clearSelection();
              setSeeds([]);
            }}
          >
            <RotateCcw className="size-4" /> Xem thuốc phổ biến
          </Button>
        )}
      </div>
    </section>
  );

  const filterPanel = (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Mức độ (DDInter)</h2>
          <button
            type="button"
            onClick={() => setHiddenSev(onlyMajor ? new Set() : new Set(["moderate", "minor", "unknown"]))}
            className="rounded px-1 py-1 text-xs font-semibold text-primary hover:underline"
          >
            {onlyMajor ? "Hiện tất cả" : "Chỉ nghiêm trọng"}
          </button>
        </div>
        <div className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          {SEVERITIES.map((s) => (
            <span
              key={s.id}
              style={{ flexGrow: counts.get(s.id) ?? 0, background: s.color, opacity: hiddenSev.has(s.id) ? 0.25 : 1 }}
              className="basis-0"
            />
          ))}
        </div>
        <ul className="mt-2 flex flex-col gap-0.5">
          {SEVERITIES.map((s) => {
            const on = !hiddenSev.has(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleSev(s.id)}
                  className={cn("flex min-h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm hover:bg-muted", !on && "opacity-50")}
                >
                  <span
                    className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-2"
                    style={{ borderColor: s.color, background: on ? s.color : "transparent" }}
                    aria-hidden="true"
                  >
                    {on && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1">{s.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{(counts.get(s.id) ?? 0).toLocaleString("vi-VN")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {userSeeds && (
        <div role="radiogroup" aria-labelledby="scope-title" className="flex flex-col gap-1.5">
          <h2 id="scope-title" className="text-sm font-semibold">
            Hiển thị cặp
          </h2>
          {SCOPES.map((sc) => {
            const on = scope === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setScope(sc.id)}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left",
                  on ? "border-primary bg-brand-soft/60" : "border-border hover:bg-muted",
                )}
              >
                <span
                  className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2", on ? "border-primary" : "border-neutral-stroke")}
                  aria-hidden="true"
                >
                  {on && <span className="size-1.5 rounded-full bg-primary" />}
                </span>
                <span className="flex flex-col">
                  <span className="text-[13px] font-semibold">{sc.label}</span>
                  <span className="text-xs text-muted-foreground">{sc.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {hiddenNodes.size > 0 && (
        <button
          type="button"
          onClick={() => setHiddenNodes(new Set())}
          className="flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-sm font-semibold text-primary hover:bg-muted"
        >
          <Eye className="size-4" /> Hiện lại {hiddenNodes.size} thuốc đã ẩn
        </button>
      )}
      <p className="text-xs text-muted-foreground">
        Quả cầu: thuốc, cỡ theo tổng số tương tác trong CSDL. Đường nối: một cặp tương tác, màu theo mức độ DDInter 2.0. Thứ tự hai thuốc không thể hiện chiều tác động.
      </p>
    </section>
  );

  return (
    <div
      className={cn(
        "relative mx-auto grid w-full gap-4 px-4 py-4 sm:px-6",
        wide
          ? "max-w-none lg:grid-cols-[minmax(0,1fr)] lg:px-4"
          : cn("max-w-[2000px]", filtersOpen ? "lg:grid-cols-[290px_minmax(0,1fr)_350px]" : "lg:grid-cols-[56px_minmax(0,1fr)_350px]"),
      )}
    >
      {/* On phones the aside dissolves into the grid so the graph sits right under the search. */}
      <aside className={cn("contents", filtersOpen ? "lg:flex lg:min-w-0 lg:flex-col lg:gap-3" : "lg:block", wide && "lg:hidden")}>
        <div className={cn("flex items-start justify-between gap-2", !filtersOpen && "lg:hidden")}>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Đồ thị tương tác 3D</h1>
            <p className="mt-0.5 hidden text-sm text-muted-foreground sm:block">
              {userSeeds ? "Thuốc bạn chọn và các thuốc tương tác nhiều nhất với chúng." : "Các thuốc có nhiều tương tác nhất trong CSDL. Thêm thuốc để xem mạng lưới của nó."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            aria-label="Thu gọn bộ lọc"
            title="Thu gọn bộ lọc"
            className="hidden size-9 shrink-0 items-center justify-center rounded-lg hover:bg-muted lg:flex"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
        <div className={cn(!filtersOpen && "lg:hidden")}>{searchPanel}</div>
        <div className={cn("order-3 lg:order-none", !filtersOpen && "lg:hidden")}>{filterPanel}</div>

        {!filtersOpen && (
          <nav aria-label="Bộ lọc thu gọn" className="hidden flex-col items-center gap-1 rounded-xl border bg-card p-1.5 lg:flex">
            <RailButton label="Mở bộ lọc" onClick={() => setFiltersOpen(true)} active>
              <ChevronRight className="size-4" />
            </RailButton>
            <span className="my-1 h-px w-7 bg-border" />
            <RailButton label={`Thuốc trung tâm: ${seeds.length}`} onClick={() => setFiltersOpen(true)}>
              <Search className="size-4" />
              {seeds.length > 0 && (
                <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {seeds.length}
                </span>
              )}
            </RailButton>
            <RailButton label={`Mức độ: ${4 - hiddenSev.size} đang bật`} onClick={() => setFiltersOpen(true)}>
              <span className="flex flex-col gap-[3px]" aria-hidden="true">
                {SEVERITIES.map((s) => (
                  <span key={s.id} className="h-[3px] w-[18px] rounded" style={{ background: s.color, opacity: hiddenSev.has(s.id) ? 0.25 : 1 }} />
                ))}
              </span>
            </RailButton>
            {userSeeds && (
              <RailButton label="Hiển thị cặp" onClick={() => setFiltersOpen(true)}>
                <Filter className="size-4" />
              </RailButton>
            )}
          </nav>
        )}
      </aside>

      <div
        ref={boxRef}
        className={cn(
          "relative order-2 h-[60vh] min-h-[380px] overflow-hidden rounded-xl border border-[#1C2A36] bg-[#0B1118] lg:order-none lg:h-[calc(100vh-130px)]",
          fullscreen && "rounded-none border-0",
        )}
      >
        {data && (
          <Graph3D
            ref={graphRef}
            nodes={nodes}
            links={shown}
            selectedNode={selectedNode}
            selectedPair={selectedPair}
            labels={labels}
            dims={dims}
            onNodeClick={selectNode}
            onLinkClick={selectPair}
            onBackgroundClick={clearSelection}
          />
        )}

        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-col items-start gap-2">
            <div className="flex flex-wrap gap-2 text-xs font-medium text-[#D3DDE6]">
              {data && (
                <span className="rounded-full bg-black/60 px-3 py-1.5 tabular-nums">
                  {nodes.length} thuốc · {shown.length.toLocaleString("vi-VN")} cặp
                </span>
              )}
              {seedMajor > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setScope("between");
                    setHiddenSev(new Set(["moderate", "minor", "unknown"]));
                  }}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-[#F04438]/50 bg-[#F04438]/20 px-3 py-1.5 font-semibold text-[#FFB4AE] hover:bg-[#F04438]/30"
                >
                  <span className="size-[7px] rounded-full bg-[#F04438]" />
                  {seedMajor} cặp nghiêm trọng giữa thuốc đã chọn
                </button>
              )}
              {graph.isFetching && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5">
                  <Loader2 className="size-3.5 animate-spin" /> Đang tải
                </span>
              )}
            </div>
            {data?.truncated && (
              <div
                role="status"
                className="pointer-events-auto flex max-w-md flex-wrap items-center gap-2 rounded-lg border border-[#F2A33A]/55 bg-[#F2A33A]/15 px-3 py-2 text-xs text-[#FCD9A8]"
              >
                <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">
                  Đạt giới hạn {data.truncated.maxNodes} thuốc, {data.truncated.omitted} thuốc lân cận bị lược bớt.
                </span>
                {neighbors > 10 && (
                  <button
                    type="button"
                    onClick={() => setNeighbors(NEIGHBOR_STEPS[NEIGHBOR_STEPS.indexOf(neighbors) - 1] ?? 10)}
                    className="rounded-md bg-[#F2A33A]/25 px-2.5 py-1 font-semibold text-[#FFE7C4] hover:bg-[#F2A33A]/35"
                  >
                    Giảm số thuốc lân cận
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="pointer-events-auto relative w-full sm:w-60">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9FB0BF]" aria-hidden="true" />
            <label htmlFor="find-in-graph" className="sr-only">
              Tìm thuốc trong đồ thị
            </label>
            <input
              id="find-in-graph"
              ref={findRef}
              value={findQ}
              autoComplete="off"
              placeholder="Tìm trong đồ thị  /"
              onChange={(e) => setFindQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (findHits[0]) flyToNode(findHits[0].id);
                  else if (addHits[0]) addSeed(addHits[0].name);
                }
                if (e.key === "Escape") setFindQ("");
              }}
              className="h-9 w-full rounded-lg border border-[#2A3A48] bg-[#080D13]/85 pr-3 pl-9 text-sm text-[#E6EDF3] placeholder:text-[#7D8C99] focus:border-[#3FD0C9] focus:outline-none"
            />
            {findQ && (
              <ul className="absolute z-20 mt-1 w-full rounded-lg border border-[#23313D] bg-[#111B24] p-1 shadow-lg">
                {findHits.length ? (
                  findHits.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => flyToNode(n.id)}
                        className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-sm text-[#E6EDF3] hover:bg-[#1E3340]"
                      >
                        <span className="truncate">{n.id}</span>
                        <span className="shrink-0 text-[11px] text-[#9FB0BF] tabular-nums">{n.degree.toLocaleString("vi-VN")}</span>
                      </button>
                    </li>
                  ))
                ) : null}
                {addHits.length > 0 && (
                  <>
                    <li className="px-2.5 pt-2 pb-1 text-[11px] font-bold tracking-wide text-[#7D8C99] uppercase">Thêm vào đồ thị</li>
                    {addHits.map((s) => (
                      <li key={s.name}>
                        <button
                          type="button"
                          onClick={() => addSeed(s.name)}
                          className="flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm text-[#E6EDF3] hover:bg-[#1E3340]"
                        >
                          <Plus className="size-3.5 shrink-0 text-[#7FE0DA]" aria-hidden="true" />
                          <span className="flex-1 truncate">{s.name}</span>
                          <span className="shrink-0 text-[11px] text-[#9FB0BF] tabular-nums">{s.degree.toLocaleString("vi-VN")}</span>
                        </button>
                      </li>
                    ))}
                  </>
                )}
                {!findHits.length && !addHits.length && (
                  <li className="px-2.5 py-2 text-sm text-[#9FB0BF]">
                    {findSuggest.isFetching ? "Đang tìm…" : "Không thấy thuốc này trong đồ thị hay CSDL."}
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        <div
          role="toolbar"
          aria-label="Điều khiển đồ thị"
          className="absolute bottom-3 left-3 flex gap-1 rounded-xl border border-[#23313D] bg-[#080D13]/85 p-1 lg:flex-col"
        >
          <ToolButton label="Vừa khung" onClick={() => graphRef.current?.zoomToFit()}>
            <Scan className="size-[18px]" />
          </ToolButton>
          <ToolButton label="Đặt lại góc nhìn" onClick={() => graphRef.current?.resetCamera()}>
            <RotateCcw className="size-[18px]" />
          </ToolButton>
          <ToolButton label={dims === 3 ? "Chuyển sang 2D" : "Chuyển sang 3D"} onClick={() => setDims(dims === 3 ? 2 : 3)}>
            <span className="text-xs font-bold">{dims === 3 ? "3D" : "2D"}</span>
          </ToolButton>
          <ToolButton
            label={LABEL_MODES.find((m) => m.id === labels)!.label}
            active={labels !== "none"}
            onClick={() => setLabels(LABEL_MODES[(LABEL_MODES.findIndex((m) => m.id === labels) + 1) % LABEL_MODES.length]!.id)}
          >
            {labels === "none" ? <EyeOff className="size-[18px]" /> : <Tag className="size-[18px]" />}
          </ToolButton>
          <ToolButton label={wide ? "Thu nhỏ về bố cục thường" : "Mở rộng không gian đồ thị"} onClick={() => setWide((v) => !v)} active={wide} className="hidden lg:flex">
            {wide ? <Shrink className="size-[18px]" /> : <Expand className="size-[18px]" />}
          </ToolButton>
          <ToolButton label="Lưu ảnh PNG" onClick={saveImage}>
            <Camera className="size-[18px]" />
          </ToolButton>
          <ToolButton label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize className="size-[18px]" /> : <Maximize className="size-[18px]" />}
          </ToolButton>
        </div>

        <div className="pointer-events-none absolute right-3 bottom-3 hidden flex-col items-end gap-1.5 text-xs text-[#C9D4DE] md:flex">
          <div className="pointer-events-auto flex gap-1 rounded-lg bg-black/70 p-1" role="group" aria-label="Lọc theo mức độ">
            {SEVERITIES.map((s) => {
              const on = !hiddenSev.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleSev(s.id)}
                  title={on ? `Ẩn mức "${s.label}"` : `Hiện mức "${s.label}"`}
                  className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 hover:bg-[#1E3340]", !on && "opacity-45")}
                >
                  <span className="h-[3px] w-4 rounded" style={{ background: s.color }} />
                  {s.label}
                  <span className="text-[#9FB0BF] tabular-nums">{(counts.get(s.id) ?? 0).toLocaleString("vi-VN")}</span>
                </button>
              );
            })}
          </div>
          <span className="rounded-full bg-black/50 px-3 py-1.5 text-[#9FB0BF]">Kéo để xoay · Cuộn để phóng · Kéo thuốc để ghim · Chuột phải để thả · Esc bỏ chọn</span>
        </div>

        {graph.isError && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-[#E6EDF3]">
            Không tải được đồ thị. Kiểm tra máy chủ rồi thử lại.
          </div>
        )}
        {data && userSeeds && data.resolved.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-[#E6EDF3]">
            Không tìm thấy thuốc nào trong cơ sở dữ liệu.
          </div>
        )}
        {data && data.resolved.length > 0 && shown.length === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center px-6 text-center text-sm text-[#E6EDF3]">
            <span className="rounded-lg bg-black/60 px-3 py-2">Không có cặp nào khớp bộ lọc hiện tại.</span>
          </div>
        )}
      </div>

      <div
        className={cn(
          "order-4 flex min-w-0 flex-col gap-3 lg:order-none lg:h-[calc(100vh-130px)]",
          wide && "lg:absolute lg:top-[5.25rem] lg:right-8 lg:z-10 lg:h-auto lg:max-h-[calc(100vh-190px)] lg:w-[380px]",
        )}
      >
        {hasDetail && (
          <section
            aria-live="polite"
            aria-label="Chi tiết"
            className={cn(
              "fixed inset-x-0 bottom-0 z-40 max-h-[50vh] overflow-auto rounded-t-2xl border-t bg-card p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.25)] lg:static lg:max-h-[62%] lg:shrink-0 lg:rounded-xl lg:border lg:shadow-xl",
              wide && "lg:max-h-[calc(100vh-190px)]",
            )}
          >
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-neutral-line lg:hidden" aria-hidden="true" />
            {selectedLink ? (
              <PairDetail
                link={selectedLink}
                detail={pairDetail.data}
                loading={pairDetail.isLoading}
                error={pairDetail.isError}
                onClose={clearSelection}
                onAnalyze={onCheckDrugs ? () => onCheckDrugs([selectedLink.source, selectedLink.target]) : undefined}
                onOnlyPair={() => {
                  clearSelection();
                  setSeeds([selectedLink.source, selectedLink.target]);
                  setNeighbors(0);
                }}
                onPickDrug={(id) => {
                  selectNode(id);
                  graphRef.current?.flyTo(id);
                }}
              />
            ) : (
              nodeInfo && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {nodeInfo.node.seed && userSeeds && <span className="text-[11px] font-bold tracking-wide text-primary">THUỐC TRUNG TÂM</span>}
                      <h2 className="text-lg font-bold">{nodeInfo.node.id}</h2>
                      <p className="text-sm text-muted-foreground">
                        {nodeInfo.node.degree.toLocaleString("vi-VN")} tương tác trong CSDL · {nodeInfo.partners.length} trong đồ thị
                      </p>
                    </div>
                    <CloseButton onClick={clearSelection} />
                  </div>
                  <SevBar by={nodeInfo.by} />
                  <div className="flex flex-wrap gap-2">
                    {!(nodeInfo.node.seed && userSeeds) && seeds.length < MAX_SEEDS && (
                      <Button className="h-10 flex-1 font-semibold" onClick={() => addSeed(nodeInfo.node.id)}>
                        <Plus className="size-4" /> Mở rộng từ thuốc này
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="h-10"
                      onClick={() => {
                        setHiddenNodes((prev) => new Set(prev).add(nodeInfo.node.id));
                        clearSelection();
                      }}
                    >
                      <EyeOff className="size-4" /> Ẩn
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <label htmlFor="partner-filter" className="sr-only">
                      Lọc thuốc tương tác
                    </label>
                    <Input
                      id="partner-filter"
                      value={partnerQ}
                      onChange={(e) => setPartnerQ(e.target.value)}
                      placeholder={`Lọc ${nodeInfo.partners.length} thuốc tương tác…`}
                      className="h-10 pl-9"
                    />
                  </div>
                  <div role="group" aria-label="Lọc theo mức độ" className="flex flex-wrap gap-1.5">
                    <Pill on={partnerSev === "all"} onClick={() => setPartnerSev("all")}>
                      Tất cả {nodeInfo.partners.length}
                    </Pill>
                    {SEVERITIES.filter((s) => nodeInfo.by.get(s.id)).map((s) => (
                      <Pill key={s.id} on={partnerSev === s.id} onClick={() => setPartnerSev(s.id)} className={s.badge}>
                        {s.label} {nodeInfo.by.get(s.id)}
                      </Pill>
                    ))}
                  </div>
                  <ul className="-mx-2 flex flex-col">
                    {partners.map((p) => {
                      const s = sevOf(p.severity);
                      return (
                        <li key={p.name}>
                          <button
                            type="button"
                            onClick={() => selectPair(nodeInfo.node.id, p.name)}
                            className="flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-left hover:bg-muted"
                          >
                            <span className="h-5 w-1 shrink-0 rounded" style={{ background: s.color }} aria-hidden="true" />
                            <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
                            {seedSet.has(p.name) && userSeeds && <span className="text-xs text-primary">đã chọn</span>}
                            <span className={cn("text-xs font-semibold", s.ink)}>{s.label}</span>
                          </button>
                        </li>
                      );
                    })}
                    {!partners.length && <li className="px-2 py-2 text-sm text-muted-foreground">Không có thuốc nào khớp.</li>}
                  </ul>
                </div>
              )
            )}
          </section>
        )}

        <section className={cn("flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card", wide && "lg:hidden")}>
          <div className="flex items-baseline justify-between gap-2 border-b px-4 pt-3.5 pb-2.5">
            <h2 className="text-sm font-bold">Cặp trong đồ thị</h2>
            <span className="text-xs text-muted-foreground">xếp theo mức độ</span>
          </div>
          <ul className="max-h-[420px] min-h-0 flex-1 overflow-auto p-1.5 lg:max-h-none">
            {sorted.slice(0, listLimit).map((l) => {
              const s = sevOf(l.severity);
              const key = pairKey(l.source, l.target);
              return (
                <li key={key}>
                  <button
                    type="button"
                    aria-current={key === selectedPair ? "true" : undefined}
                    onClick={() => selectPair(l.source, l.target)}
                    className={cn("flex min-h-11 w-full items-center gap-2.5 rounded-md px-2 text-left hover:bg-muted", key === selectedPair && "bg-brand-soft/70")}
                  >
                    <span className="h-6 w-1 shrink-0 rounded" style={{ background: s.color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-[13px]">
                      <b className={cn("font-semibold", seedSet.has(l.source) && userSeeds && "text-brand-ink")}>{l.source}</b>
                      {" + "}
                      <span className={cn(seedSet.has(l.target) && userSeeds && "font-semibold text-brand-ink")}>{l.target}</span>
                    </span>
                    <span className={cn("shrink-0 text-[11px] font-semibold", s.ink)}>{s.label}</span>
                  </button>
                </li>
              );
            })}
            {sorted.length > listLimit && (
              <li>
                <button
                  type="button"
                  onClick={() => setListLimit((n) => n + LIST_STEP * 5)}
                  className="min-h-10 w-full rounded-md text-sm font-semibold text-primary hover:bg-muted"
                >
                  Xem thêm ({(sorted.length - listLimit).toLocaleString("vi-VN")} cặp)
                </button>
              </li>
            )}
            {data && !sorted.length && <li className="px-3 py-3 text-sm text-muted-foreground">Không có cặp nào khớp bộ lọc.</li>}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t px-4 py-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {Math.min(listLimit, sorted.length).toLocaleString("vi-VN")} / {sorted.length.toLocaleString("vi-VN")} cặp
            </span>
            <button
              type="button"
              onClick={saveCsv}
              disabled={!sorted.length}
              className="inline-flex min-h-9 items-center gap-1.5 rounded px-1.5 text-[13px] font-semibold text-primary hover:underline disabled:opacity-50"
            >
              <Download className="size-4" /> Tải CSV
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function PairDetail({
  link,
  detail,
  loading,
  error,
  onClose,
  onAnalyze,
  onOnlyPair,
  onPickDrug,
}: {
  link: GraphLink;
  detail: Awaited<ReturnType<typeof v2API.graphPair>> | undefined;
  loading: boolean;
  error: boolean;
  onClose: () => void;
  onAnalyze?: () => void;
  onOnlyPair: () => void;
  onPickDrug: (id: string) => void;
}) {
  const s = sevOf(link.severity);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className={cn("inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-xs font-bold uppercase", s.badge)}>
          <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />
          {s.label}
        </span>
        <CloseButton onClick={onClose} />
      </div>
      <h2 className="text-lg leading-snug font-bold">
        <button type="button" onClick={() => onPickDrug(link.source)} className="hover:underline">
          {link.source}
        </button>
        <span className="px-1.5 font-medium text-muted-foreground">+</span>
        <button type="button" onClick={() => onPickDrug(link.target)} className="hover:underline">
          {link.target}
        </button>
      </h2>
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Đang tải chi tiết…
        </p>
      ) : error || !detail ? (
        <p className="text-sm text-muted-foreground">Không tải được chi tiết cặp này.</p>
      ) : (
        <>
          <DetailBlock title="Cơ chế">
            {detail.descriptions.length || detail.mechanisms.length ? (
              <>
                {detail.mechanisms.length > 0 && <p className="text-sm text-muted-foreground">{detail.mechanisms.join(" · ")}</p>}
                {detail.descriptions.map((d) => (
                  <p key={d}>{d}</p>
                ))}
              </>
            ) : (
              <p className="text-muted-foreground">DDInter chưa có mô tả cơ chế cho cặp này.</p>
            )}
          </DetailBlock>
          {detail.management.length > 0 && (
            <DetailBlock title="Xử trí">
              {detail.management.map((m) => (
                <p key={m}>{m}</p>
              ))}
            </DetailBlock>
          )}
          {detail.urls[0] && (
            <a
              href={detail.urls[0]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-primary hover:underline"
            >
              Xem trên DDInter 2.0 <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {onAnalyze && (
          <Button className="h-10 flex-1 font-semibold" onClick={onAnalyze}>
            <Sparkles className="size-4" /> Phân tích cặp này
          </Button>
        )}
        <Button variant="outline" className="h-10" onClick={onOnlyPair}>
          Chỉ xem 2 thuốc
        </Button>
      </div>
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div className="flex flex-col gap-1.5 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

function SevBar({ by }: { by: Map<GraphSeverity, number> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {SEVERITIES.map((s) => (
          <span key={s.id} className="basis-0" style={{ flexGrow: by.get(s.id) ?? 0, background: s.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-neutral-ink">
        {SEVERITIES.filter((s) => by.get(s.id)).map((s) => (
          <span key={s.id}>
            <b className={s.ink}>{by.get(s.id)}</b> {s.label.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Đóng chi tiết"
      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
    >
      <X className="size-4" />
    </button>
  );
}

function Pill({ on, onClick, className, children }: { on: boolean; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "h-8 rounded-full border px-3 text-xs font-semibold",
        on ? "border-foreground bg-foreground text-background" : cn("border-transparent", className ?? "bg-muted text-neutral-ink"),
      )}
    >
      {children}
    </button>
  );
}

function ToolButton({ label, onClick, active, className, children }: { label: string; onClick: () => void; active?: boolean; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-10 items-center justify-center rounded-lg text-[#D3DDE6] hover:bg-[#1E3340]",
        active && "bg-[#1E3340] text-[#7FE0DA]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function RailButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("relative flex size-11 items-center justify-center rounded-lg hover:bg-muted", active && "bg-muted")}
    >
      {children}
    </button>
  );
}
