import type { Database } from 'better-sqlite3';
import type { LinkCache, LinkInfo } from '../domain/links.ts';

/** Generic TTL key/value cache in the app DB. */
export class SqlCache {
  readonly #get;
  readonly #set;
  readonly #purge;

  constructor(db: Database) {
    this.#get = db.prepare('SELECT value_json FROM cache WHERE kind = ? AND key = ? AND expires_at > ?');
    this.#set = db.prepare(
      'INSERT INTO cache(kind, key, value_json, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(kind, key) DO UPDATE SET value_json = excluded.value_json, expires_at = excluded.expires_at',
    );
    this.#purge = db.prepare('DELETE FROM cache WHERE expires_at <= ?');
  }

  get<T>(kind: string, key: string): T | undefined {
    const row = this.#get.get(kind, key, Date.now()) as { value_json: string } | undefined;
    return row ? (JSON.parse(row.value_json) as T) : undefined;
  }

  set(kind: string, key: string, value: unknown, ttlMs: number): void {
    this.#set.run(kind, key, JSON.stringify(value), Date.now() + ttlMs);
  }

  purgeExpired(): number {
    return this.#purge.run(Date.now()).changes;
  }

  linkCache(): LinkCache {
    return {
      get: (k) => this.get<LinkInfo>('link', k),
      set: (k, v, ttl) => this.set('link', k, v, ttl),
    };
  }
}
