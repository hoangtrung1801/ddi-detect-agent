import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { Database } from 'better-sqlite3';
import type { InteractionReport } from '../schemas/report.ts';

/** Anonymous slot for legacy clients whose /query call carries no session id. */
export const DEFAULT_SESSION = 'default';

export interface SessionInfo {
  id: string;
  created_at: string;
  updated_at: string;
  has_report: boolean;
  message_count: number;
}

export class SessionStore {
  readonly #db: Database;
  readonly #maxTurns: number;

  constructor(db: Database, maxTurns = 12) {
    this.#db = db;
    this.#maxTurns = maxTurns;
  }

  exists(id: string): boolean {
    return !!this.#db.prepare('SELECT 1 FROM sessions WHERE id = ?').get(id);
  }

  ensure(id: string): void {
    const now = new Date().toISOString();
    this.#db.prepare('INSERT OR IGNORE INTO sessions(id, created_at, updated_at) VALUES (?, ?, ?)').run(id, now, now);
  }

  getMessages(id: string): AgentMessage[] {
    return (
      this.#db.prepare('SELECT message_json FROM session_messages WHERE session_id = ? ORDER BY seq').all(id) as { message_json: string }[]
    ).map((r) => JSON.parse(r.message_json) as AgentMessage);
  }

  /** Replace the stored transcript. System messages are not stored; only the last N user turns are kept. */
  saveMessages(id: string, messages: AgentMessage[]): void {
    const kept = trimToTurns(
      messages.filter((m) => (m as { role: string }).role !== 'system'),
      this.#maxTurns,
    );
    this.ensure(id);
    const del = this.#db.prepare('DELETE FROM session_messages WHERE session_id = ?');
    const ins = this.#db.prepare('INSERT INTO session_messages(session_id, seq, message_json) VALUES (?, ?, ?)');
    const touch = this.#db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?');
    this.#db.transaction(() => {
      del.run(id);
      kept.forEach((m, i) => ins.run(id, i, JSON.stringify(m)));
      touch.run(new Date().toISOString(), id);
    })();
  }

  setReport(id: string, report: InteractionReport): void {
    this.ensure(id);
    this.#db
      .prepare('UPDATE sessions SET last_report_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(report), new Date().toISOString(), id);
  }

  getReport(id: string): InteractionReport | undefined {
    const row = this.#db.prepare('SELECT last_report_json FROM sessions WHERE id = ?').get(id) as { last_report_json: string | null } | undefined;
    return row?.last_report_json ? (JSON.parse(row.last_report_json) as InteractionReport) : undefined;
  }

  delete(id: string): boolean {
    return this.#db.transaction(() => {
      this.#db.prepare('DELETE FROM session_messages WHERE session_id = ?').run(id);
      return this.#db.prepare('DELETE FROM sessions WHERE id = ?').run(id).changes > 0;
    })();
  }

  /** Sessions that hold a chat transcript (the anonymous report slot does not count). */
  count(): number {
    return (this.#db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE id <> ?').get(DEFAULT_SESSION) as { n: number }).n;
  }

  info(id: string): SessionInfo | undefined {
    const s = this.#db.prepare('SELECT id, created_at, updated_at, last_report_json FROM sessions WHERE id = ?').get(id) as
      | { id: string; created_at: string; updated_at: string; last_report_json: string | null }
      | undefined;
    if (!s) return undefined;
    const n = (this.#db.prepare('SELECT COUNT(*) AS n FROM session_messages WHERE session_id = ?').get(id) as { n: number }).n;
    return { id: s.id, created_at: s.created_at, updated_at: s.updated_at, has_report: !!s.last_report_json, message_count: n };
  }
}

/** Keep the last `maxTurns` user turns (a turn starts at a user message) so tool calls and results are never split. */
export function trimToTurns(messages: AgentMessage[], maxTurns: number): AgentMessage[] {
  const userIdx: number[] = [];
  messages.forEach((m, i) => {
    if ((m as { role: string }).role === 'user') userIdx.push(i);
  });
  if (userIdx.length <= maxTurns) return messages;
  return messages.slice(userIdx[userIdx.length - maxTurns]!);
}
