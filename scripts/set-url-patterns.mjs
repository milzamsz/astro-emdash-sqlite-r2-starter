/**
 * Set each EmDash collection's `url_pattern` so the admin "View on site" /
 * Live View link — and all framework routing (sitemaps, menus, redirects,
 * `resolveEmDashPath`) — points at this template's real public routes.
 *
 * Without a `url_pattern`, EmDash falls back to `/{collection}/{slug}`, so the
 * Contact page links to `/pages/contact` (a route that does not exist here)
 * instead of `/contact`. This template serves pages at the top level and posts
 * under `/blog`, so:
 *
 *   pages -> /{slug}        (e.g. contact -> /contact)
 *   posts -> /blog/{slug}   (e.g. welcome -> /blog/welcome)
 *
 * Fresh installs get these from `seed/seed.json`. Run this once against an
 * already-seeded database, then restart the app so the cached URL patterns are
 * rebuilt:
 *
 *   pnpm set-url-patterns
 *
 * In a container: `cd /app && pnpm set-url-patterns` (then restart the service).
 *
 * Pass `key=value` pairs to override the defaults, e.g.
 *   pnpm set-url-patterns pages=/{slug} posts=/news/{slug}
 */
import Database from "better-sqlite3";

const DEFAULTS = {
  pages: "/{slug}",
  posts: "/blog/{slug}",
};

const overrides = {};
for (const arg of process.argv.slice(2)) {
  const eq = arg.indexOf("=");
  if (eq === -1) {
    console.error(`Ignoring "${arg}" (expected slug=pattern)`);
    continue;
  }
  overrides[arg.slice(0, eq)] = arg.slice(eq + 1);
}

const patterns = { ...DEFAULTS, ...overrides };

const dbPath = (process.env.DATABASE_URL ?? "file:./data/emdash.db").replace(
  /^file:/,
  "",
);

const db = new Database(dbPath);
db.pragma("busy_timeout = 5000");

const update = db.prepare(
  "UPDATE _emdash_collections SET url_pattern = ? WHERE slug = ?",
);

for (const [slug, pattern] of Object.entries(patterns)) {
  const result = update.run(pattern, slug);
  if (result.changes === 0) {
    console.warn(`No collection named "${slug}" — skipped.`);
  } else {
    console.log(`${slug} -> ${pattern}`);
  }
}

const rows = db
  .prepare("SELECT slug, url_pattern FROM _emdash_collections ORDER BY slug")
  .all();
console.log("\nCurrent url_pattern values:");
for (const row of rows) {
  console.log(`  ${row.slug}: ${row.url_pattern ?? "(unset → /{collection}/{slug})"}`);
}

db.close();
console.log("\nRestart the app so cached URL patterns are rebuilt.");
