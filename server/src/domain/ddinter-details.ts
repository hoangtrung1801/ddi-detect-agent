import { createHash } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import { parseHTML, type HTMLElement } from 'linkedom';

export interface InteractionDetail {
  pageId: number;
  drugAId: string;
  drugBId: string;
  drugAName: string;
  drugBName: string;
  level: 'Major' | 'Moderate' | 'Minor' | 'Unknown';
  mechanisms: string[];
  description: string | null;
  management: string | null;
  references: string[];
  url: string;
  retrievedAt: string;
  sha256: string;
}

/** Extract only pair-specific fields, never alternatives or the generic CYP footer. */
export function parseInteractionPage(html: string, pageId: number, retrievedAt: string): InteractionDetail {
  const { document } = parseHTML(html);
  const banner = document.querySelector('main [role="alert"]');
  const names = [...(banner?.querySelectorAll('strong') ?? [])].map((n) => n.textContent?.replace(/\s+/g, ' ').trim());
  const badges = [...(banner?.querySelectorAll('.badge') ?? [])].map((n) => n.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  const level = badges[0];
  if (names.length !== 2 || names.some((n) => !n) || !['Major', 'Moderate', 'Minor', 'Unknown'].includes(level ?? '')) {
    throw new Error(`Interaction ${pageId}: expected pair banner and risk level, not an error/login/challenge page`);
  }
  const fields = new Map<string, HTMLElement>();
  for (const key of document.querySelectorAll('main table td.key')) {
    const name = key.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const value = key.parentElement?.querySelector('td.value');
    if (value && ['ID', 'Interaction', 'Management', 'References'].includes(name)) {
      if (fields.has(name)) throw new Error(`Interaction ${pageId}: duplicate ${name} field`);
      fields.set(name, value);
    }
  }
  if (fields.size !== 4) throw new Error(`Interaction ${pageId}: missing basic information fields`);
  const ids = [...fields.get('ID')!.querySelectorAll('a')].map((a) => a.textContent?.trim() ?? '');
  if (ids.length !== 2 || ids.some((id) => !/^DDInter\d+$/.test(id)) || ids[0] === ids[1]) throw new Error(`Interaction ${pageId}: invalid pair IDs`);
  const text = (field: string) => {
    const value = fields.get(field)!.innerText.replace(/\s+/g, ' ').trim();
    return !value || /^[-–—]$/.test(value) ? null : value;
  };
  const spans = [...fields.get('References')!.querySelectorAll('span')];
  const references = spans.length ? spans.map((s) => s.textContent?.replace(/\s+/g, ' ').trim() ?? '').filter((s) => s && !/^[-–—]$/.test(s)) : text('References') ? [text('References')!] : [];
  return {
    pageId, drugAId: ids[0]!, drugBId: ids[1]!, drugAName: names[0]!, drugBName: names[1]!,
    level: level as InteractionDetail['level'], mechanisms: badges.slice(1),
    description: text('Interaction'), management: text('Management'), references,
    url: `https://ddinter2.scbdd.com/server/interact/${pageId}/`, retrievedAt,
    sha256: createHash('sha256').update(html).digest('hex'),
  };
}

export function createInteractionDetailsTable(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS interaction_details(
    page_id INTEGER PRIMARY KEY, a INTEGER NOT NULL, b INTEGER NOT NULL, detail_json TEXT NOT NULL,
    FOREIGN KEY(a,b) REFERENCES interactions(a,b)
  ); CREATE INDEX IF NOT EXISTS interaction_details_pair ON interaction_details(a,b);`);
}

/** Match stable source IDs, not names or numeric page order. Never add pairs or change CSV severity. */
export function applyInteractionDetail(db: Database, detail: InteractionDetail): boolean {
  const row = db.prepare(`SELECT i.a,i.b FROM drugs a,drugs b,interactions i
    WHERE a.source_id=? AND b.source_id=? AND i.a=min(a.id,b.id) AND i.b=max(a.id,b.id)`)
    .get(detail.drugAId, detail.drugBId) as { a: number; b: number } | undefined;
  if (!row) return false;
  db.prepare('INSERT INTO interaction_details(page_id,a,b,detail_json) VALUES (?,?,?,?) ON CONFLICT(page_id) DO UPDATE SET a=excluded.a,b=excluded.b,detail_json=excluded.detail_json').run(detail.pageId, row.a, row.b, JSON.stringify(detail));
  return true;
}
