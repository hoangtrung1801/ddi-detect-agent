import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Load .env files (server/.env first, then repo-root .env). Existing process env wins.
export function loadEnvFiles(): void {
  for (const rel of ['../.env', '../../.env']) {
    const p = fileURLToPath(new URL(rel, import.meta.url));
    if (existsSync(p)) {
      try {
        process.loadEnvFile(p);
      } catch {
        /* ignore malformed env file */
      }
    }
  }
}
