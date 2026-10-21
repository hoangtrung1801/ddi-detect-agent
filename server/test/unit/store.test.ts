import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../src/config.ts';
import { migrate, openAppDb } from '../../src/store/app-db.ts';
import { SqlCache } from '../../src/store/cache.ts';
import { SessionStore, trimToTurns } from '../../src/store/sessions.ts';

const user = (t: string) => ({ role: 'user', content: t, timestamp: 1 }) as any;
const asst = (t: string) => ({ role: 'assistant', content: [{ type: 'text', text: t }] }) as any;
const tool = () => ({ role: 'toolResult', toolCallId: 'x', toolName: 'y', content: [], isError: false, timestamp: 1 }) as any;

describe('app db', () => {
  it('migrates once and is idempotent', () => {
    const db = openAppDb(':memory:');
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    migrate(db);
    expect(db.pragma('user_version', { simple: true })).toBe(1);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((t) => t.name);
    expect(tables).toEqual(expect.arrayContaining(['sessions', 'session_messages', 'cabinet_drugs', 'cabinet_pairs', 'cache']));
  });
});

describe('SessionStore', () => {
  it('round-trips messages, drops system messages, trims to the last N user turns without splitting tool results', () => {
    const s = new SessionStore(openAppDb(':memory:'), 2);
    const msgs = [{ role: 'system', content: 'sys' } as any, user('1'), asst('a1'), user('2'), asst('call'), tool(), asst('a2'), user('3'), asst('a3')];
    s.saveMessages('s', msgs);
    const got = s.getMessages('s');
    expect(got.map((m: any) => m.role)).toEqual(['user', 'assistant', 'tool' + 'Result', 'assistant', 'user', 'assistant']);
    expect((got[0] as any).content).toBe('2');
    expect(s.info('s')).toMatchObject({ id: 's', message_count: 6, has_report: false });
  });
  it('trimToTurns keeps everything when under the limit', () => {
    const m = [user('1'), asst('a')];
    expect(trimToTurns(m, 5)).toBe(m);
  });
  it('reports, counts and deletion', () => {
    const s = new SessionStore(openAppDb(':memory:'));
    s.setReport('a', { title: 't' } as any);
    s.setReport('default', { title: 'd' } as any);
    expect(s.getReport('a')).toEqual({ title: 't' });
    expect(s.count()).toBe(1); // anonymous slot excluded
    expect(s.delete('a')).toBe(true);
    expect(s.delete('a')).toBe(false);
    expect(s.exists('a')).toBe(false);
  });
});

describe('SqlCache', () => {
  it('honours TTL', () => {
    const c = new SqlCache(openAppDb(':memory:'));
    vi.useFakeTimers();
    c.set('k', 'a', { v: 1 }, 1000);
    expect(c.get('k', 'a')).toEqual({ v: 1 });
    vi.advanceTimersByTime(1500);
    expect(c.get('k', 'a')).toBeUndefined();
    expect(c.purgeExpired()).toBe(1);
    vi.useRealTimers();
  });
});

describe('config', () => {
  it('defaults and validation', () => {
    const cfg = loadConfig({ OPENAI_API_KEY: 'k' } as any);
    expect(cfg).toMatchObject({ port: 8000, maxTurns: 6, resolveMin: 0.8, queryTimeoutMs: 60000 });
    expect(() => loadConfig({ PORT: 'abc' } as any)).toThrow(/Invalid configuration/);
    expect(() => loadConfig({ RESOLVE_MIN: '2' } as any)).toThrow(/Invalid configuration/);
    expect(() => loadConfig({ REASONING_EFFORT: 'turbo' } as any)).toThrow(/Invalid configuration/);
  });
});
