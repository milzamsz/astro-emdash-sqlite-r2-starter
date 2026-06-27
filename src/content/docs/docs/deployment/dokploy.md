---
title: Dokploy (Docker)
description: Self-hosting the server-rendered site with EmDash on Dokploy.
sidebar:
  order: 1
---

The site is server-rendered with the Astro Node adapter and the EmDash CMS, so it
deploys as a long-running Node server rather than static files. The repo ships a
multi-stage `Dockerfile` that builds a standalone server (`dist/server/entry.mjs`).

## Deploy on Dokploy

1. Push the repo to GitHub.
2. In Dokploy, create an **Application** from the repository using the Dockerfile build.
3. **Mount a persistent volume at `/app/data`.** This holds the SQLite database
   (`emdash.db`) and any local uploads, so content survives redeploys.
4. Set environment variables (see [Environment Variables](/docs/deployment/environment-variables/)):
   `SITE_URL`, the `S3_*` Cloudflare R2 credentials, and any optional analytics keys.
5. Expose port **4321** and point your domain at the service.
6. Deploy. On a fresh volume, the entrypoint seeds content automatically (below).

## Cloudflare R2 media

In production, media is stored in Cloudflare R2 through its S3-compatible API. Create
an R2 bucket and an S3 API token, then set `S3_ENDPOINT`, `S3_BUCKET`,
`S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. Optionally attach a custom domain to the
bucket and set `S3_PUBLIC_URL` so assets serve from your CDN domain. If `S3_BUCKET` is
unset, EmDash falls back to local filesystem storage under `./data/uploads`.

## Database, migrations & seeding

The SQLite database is runtime state and is not committed to git - it lives on the
`/app/data` volume. On deploy:

- The server runs **schema migrations automatically** on the first request, creating the
  database and tables on the volume.
- The container `docker-entrypoint.sh` runs `emdash seed` from `seed/seed.json` **only
  when no database exists yet** (a fresh volume), so a first deploy comes up populated and
  redeploys never overwrite your data.

To seed or re-seed manually (e.g. outside Docker):

```bash
pnpm exec emdash seed --database data/emdash.db --uploads-dir data/uploads
```

Afterwards, content is edited through the admin panel at `/_emdash/admin` (create the
owner account on first visit) and requires no redeploy.

## Local Docker test

```bash
docker build -t astro-emdash .
docker run --rm -p 4321:4321 -v "$PWD/data:/app/data" astro-emdash
```