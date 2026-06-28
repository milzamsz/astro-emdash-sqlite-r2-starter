# Setup & Deployment

This template is server-rendered Astro backed by the EmDash CMS. Local dev uses
SQLite + local file storage with zero config; production self-hosts on Dokploy
with SQLite on a persistent volume and media on Cloudflare R2.

## Prerequisites

- Node.js 24+
- pnpm 8.15+ (`corepack enable && corepack prepare pnpm@8.15.0 --activate`)
- For production media: a Cloudflare account with an R2 bucket (optional)

## Local development

```bash
pnpm install
cp .env.example .env   # optional locally; set SITE_URL for correct prod URLs
pnpm dev
```

`pnpm dev` runs `emdash dev`, which:

1. Starts the Astro dev server on http://localhost:4321
2. Runs database migrations against `./data/emdash.db` (SQLite)
3. Seeds `seed/seed.json` on first run (collections + starter content)

Then:

- Site: http://localhost:4321 — default locale at `/` and `/id/`, English at `/en/`
- Admin: http://localhost:4321/_emdash/admin — create the owner account on first visit

Local uploads are written to `./data/uploads` and served by EmDash. The `./data`
directory is gitignored and safe to delete to reset to a clean seeded state.

## Editing content

- Author the **blog** and **pages** collections in the admin panel.
- Routes read EmDash at request time via `src/lib/cms.ts`; no rebuild is needed.
- Run `pnpm types:cms` after changing collection schemas to refresh generated types.
- Run `pnpm export-seed` to snapshot current content back into a seed file.

## Build

```bash
pnpm build     # outputs the server build to dist/ (Node adapter, standalone)
pnpm start     # run the production server: node ./dist/server/entry.mjs
```

The server listens on `HOST`/`PORT` (defaults `0.0.0.0:4321`).

## Environment variables

Set these in production (Dokploy → service → Environment). See `.env.example`.

| Variable | Required | Purpose |
|----------|----------|---------|
| `SITE_URL` | recommended | Public production URL (canonical/OG/sitemap) |
| `DATABASE_URL` | no | SQLite path; defaults to `file:./data/emdash.db` |
| `S3_ENDPOINT` | for R2 | R2 S3 endpoint `https://<accountid>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | for R2 | R2 bucket name (presence of this switches storage to R2) |
| `S3_ACCESS_KEY_ID` | for R2 | R2 access key (secret) |
| `S3_SECRET_ACCESS_KEY` | for R2 | R2 secret key (secret) |
| `S3_REGION` | no | `auto` for R2 |
| `S3_PUBLIC_URL` | no | Inert — media is served via EmDash's proxy route; leave empty |
| `RESEND_API_KEY` | no | Enables magic-link sign-in / invites via Resend (auto-selected when set) |
| `EMAIL_FROM` | with Resend | Verified sender, e.g. `Acme <noreply@your-domain>` |
| `DISABLE_SECURITY_HEADERS` | no | Set to `1` to turn off the built-in CSP/HSTS middleware |

If `S3_BUCKET` is empty, EmDash falls back to local filesystem storage under `./data/uploads`.

If `RESEND_API_KEY` is unset, EmDash uses copy-link invites instead of sending email.
When changing the public URL, also update the value stored in the database (used to build
outbound email links): `pnpm set-site-url https://your-domain`.

Uploads `PUT` directly to R2 from the browser, so the bucket needs a CORS policy
allowing your site origin (`GET`, `PUT`, `HEAD`). The bucket can stay private: EmDash
serves media through its own proxy route (`/_emdash/api/media/file/<key>`) that streams
objects from R2, so the admin always shows that path even though the file lives in R2.

## Deploy to Dokploy (Docker)

The repo ships a multi-stage `Dockerfile` that builds the standalone Node server.

1. Push the repo to GitHub.
2. In Dokploy, create an **Application** from the repository (Dockerfile build).
3. **Mount a persistent volume at `/app/data`** so the SQLite database and any local
   uploads survive redeploys. (With R2 configured, media goes to R2; the volume still
   holds the database.)
4. Set environment variables (`SITE_URL`, the `S3_*` R2 credentials, optional analytics).
5. Expose port `4321` and point your domain at the service.
6. Deploy. On first boot, run migrations/seed once (see below).
7. Enable compression at the proxy (see below) for best Lighthouse performance.

### Compression (gzip / Brotli)

The Astro Node adapter serves HTML/CSS/JS **uncompressed**. Compress at the **Traefik**
reverse proxy Dokploy runs: add a `compress` middleware (excluding `text/event-stream` so
EmDash live preview keeps working) and attach it to the app's router. Verify with
`curl -sI -H "Accept-Encoding: br,gzip" https://your-domain | grep -i content-encoding`.
Full config is in `/docs/deployment/dokploy`.

### Security headers (CSP / HSTS)

`src/middleware/security-headers.ts` sends a strict, hash-based `Content-Security-Policy`
(no `'unsafe-inline'` for scripts) plus HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, and `Permissions-Policy` on server-rendered pages. Astro middleware
doesn't run for prerendered routes (`/docs`, `404`) or static assets, so also add a Traefik
`headers` middleware for blanket coverage — full config is in `/docs/deployment/dokploy`.
Disable the app-level middleware with `DISABLE_SECURITY_HEADERS=1`.

### Cloudflare R2

Create an R2 bucket and an S3 API token (Access Key ID + Secret). Set `S3_ENDPOINT`,
`S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`, and add a CORS policy on the
bucket allowing your site origin (`GET`, `PUT`, `HEAD`) for browser uploads. The bucket
can stay private — media is delivered through EmDash's same-origin proxy route, so
`S3_PUBLIC_URL` is not required.

### Database, migrations & seeding

The SQLite database is **runtime state**, not source code — it lives on the `/app/data`
volume and is intentionally gitignored. It gets there as follows:

- **Schema migrations** run automatically the first time the server handles a request,
  so the database file and tables are created on the volume with no manual step.
- **Starter content** is loaded by the container's `docker-entrypoint.sh`, which runs
  `emdash seed` from `seed/seed.json` **only when the database doesn't exist yet** (a
  fresh volume). Existing data is never touched, so redeploys are safe.

So a first Dokploy deploy on an empty volume comes up already populated. To seed or
re-seed manually (e.g. running outside Docker), run the CLI against the data directory:

```bash
pnpm exec emdash seed --database data/emdash.db --uploads-dir data/uploads
```

Content edits then happen through the admin panel and require no redeploy. The first
visit to `/_emdash/admin` prompts you to create the owner account.

**Changing the schema** (editing collections/fields in `seed/seed.json`) only affects a
fresh database — the entrypoint never re-seeds an existing one. To apply schema changes to
a live deployment, either:

- delete `emdash.db*` on the `/app/data` volume and redeploy (re-seeds from scratch; R2
  media is unaffected), or
- run a targeted migration. For example, after adding `urlPattern` to collections in an
  older database, run `pnpm set-url-patterns` and restart.

## CI

`.github/workflows/ci.yml` runs lint, type-check, i18n validation, secret
scanning, dependency review, and a build on every PR.
