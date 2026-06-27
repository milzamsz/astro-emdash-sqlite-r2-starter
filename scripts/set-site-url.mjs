/**
 * Set the EmDash canonical site URL stored in the database.
 *
 * EmDash saves `emdash:site_url` once during the setup wizard (whatever origin
 * the browser used at that moment). That stored value — not the SITE_URL env —
 * is what builds outbound links such as magic-link logins, invites, and account
 * recovery emails (see emdash `getSiteBaseUrl`). If setup was completed on the
 * wrong host (e.g. a temporary *.sslip.io domain), those links point there.
 *
 * Run this once on the canonical domain to fix it:
 *
 *   pnpm set-site-url https://your-domain.example
 *
 * In a container: `cd /app && pnpm set-site-url https://your-domain.example`.
 * The change is read fresh on the next send, so no restart is required.
 */
import Database from "better-sqlite3";

const input = process.argv[2];
if (!input || !/^https?:\/\//.test(input)) {
  console.error("Usage: pnpm set-site-url https://your-domain.example");
  process.exit(1);
}

let origin;
try {
  origin = new URL(input).origin;
} catch {
  console.error(`Invalid URL: "${input}"`);
  process.exit(1);
}

const dbPath = (process.env.DATABASE_URL ?? "file:./data/emdash.db").replace(
  /^file:/,
  "",
);

const db = new Database(dbPath);
db.pragma("busy_timeout = 5000");

const value = JSON.stringify(origin);
const result = db
  .prepare("UPDATE options SET value = ? WHERE name = 'emdash:site_url'")
  .run(value);

if (result.changes === 0) {
  db.prepare(
    "INSERT INTO options (name, value) VALUES ('emdash:site_url', ?)",
  ).run(value);
}

const stored = db
  .prepare("SELECT value FROM options WHERE name = 'emdash:site_url'")
  .get();
console.log(`emdash:site_url = ${stored?.value ?? "(unset)"}`);
db.close();
