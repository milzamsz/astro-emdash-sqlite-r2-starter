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
`S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`. If `S3_BUCKET` is unset, EmDash falls
back to local filesystem storage under `./data/uploads`.

Uploads `PUT` directly to R2 from the browser via presigned URLs, so the bucket needs a
**CORS policy** allowing your site origin (`GET`, `PUT`, `HEAD`). The bucket can stay
**private** — EmDash serves media through its own proxy route
(`/_emdash/api/media/file/<key>`) that streams objects from R2, so URLs always look
same-origin and `S3_PUBLIC_URL` is not needed. See
[Environment Variables → Media storage](/docs/deployment/environment-variables/) for the
exact CORS policy and details.

## Enable compression (gzip / Brotli)

The Astro Node adapter serves HTML, CSS, and JS **uncompressed** — it has no built-in
compression. On its own that drags Lighthouse Performance down (a ~53 KB stylesheet ships
in full, inflating FCP/LCP) even though the server is fast. Compress at the **Traefik**
reverse proxy that Dokploy already runs.

In Dokploy: open the application → **Advanced → Traefik** and add a `compress` middleware,
then attach it to the app's router. The dynamic config looks like:

```yaml
http:
  middlewares:
    site-compress:
      compress:
        # Don't compress Server-Sent Events — EmDash's live preview uses them.
        excludedContentTypes:
          - text/event-stream
  routers:
    # Add the middleware to the existing router Dokploy generated for this app:
    <existing-router-name>:
      middlewares:
        - site-compress
```

After saving, verify with `curl -sI -H "Accept-Encoding: br,gzip" https://your-domain/`
— the response should include `content-encoding: br` (or `gzip`). This typically takes
Lighthouse Performance from ~90 to ~100, since the render-blocking CSS and JS now transfer
at a fraction of their size.

> The public marketing pages ship almost no JavaScript (the interactive bits are plain
> Astro + tiny inline scripts), so compression is the main remaining lever. The heavy
> React bundles you may see under `/_astro` belong to the EmDash admin and only load on
> `/_emdash` routes.

## Security headers (CSP / HSTS)

The app ships a middleware (`src/middleware/security-headers.ts`) that sends real
security headers on the public site: a strict `Content-Security-Policy`, plus
`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, and `Cross-Origin-Opener-Policy`. The CSP is
**nonce-free and `'unsafe-inline'`-free for scripts** — it buffers each HTML response and
computes a SHA-256 hash for every inline `<script>` actually emitted (the dark-mode
bootstrap, analytics snippets, …) and auto-allowlists external script origins, so it
stays strict without manual maintenance. The EmDash admin (`/_emdash`) is left to its own
CSP. Set `DISABLE_SECURITY_HEADERS=1` to turn the middleware off (e.g. if your edge
already sets these).

> **Coverage note:** Astro middleware runs for server-rendered routes only. The
> prerendered Starlight `/docs` pages, the `404`, and static assets under `/_astro` are
> served directly by the Node adapter and **bypass** the middleware. For blanket coverage
> (including those routes), also set headers at the **Traefik** layer — this is the
> recommended production setup:

```yaml
http:
  middlewares:
    site-headers:
      headers:
        stsSeconds: 63072000
        stsIncludeSubdomains: true
        stsPreload: true
        contentTypeNosniff: true
        referrerPolicy: strict-origin-when-cross-origin
        frameDeny: true
        permissionsPolicy: "camera=(), microphone=(), geolocation=(), browsing-topics=()"
  routers:
    <existing-router-name>:
      middlewares:
        - site-compress
        - site-headers
```

Leave the per-app CSP to the middleware (it varies per page), or replicate a static CSP
here if you prefer the proxy to own everything.

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