# Astro EmDash Starter

A production-ready marketing + blog + docs site built with **Astro 7** and the **[EmDash](https://github.com/emdash-cms/emdash) CMS**. English-first and multilanguage-ready. Content is authored in the EmDash admin panel and stored in **SQLite**, with media on **Cloudflare R2** in production. Designed to **self-host on Dokploy** (or any Docker host).

## Features

- EmDash CMS as the single source of truth for the blog and pages (Portable Text rich content)
- Pages use **typed fields** (hero, a `features` repeater, CTA) instead of hand-written JSON
- English-first with a multilanguage-ready i18n engine (prefix-based routing)
- Marketing pages, blog, and Starlight-powered docs with full-text search
- Minimal client JS: interactive bits are plain Astro + tiny inline scripts (no React on public pages)
- Light/dark theming with a monochrome OKLCH design system
- SEO defaults: canonical, hreflang, JSON-LD, Open Graph, sitemap, RSS, dynamic `llms.txt`
- Optional magic-link sign-in via [Resend](https://resend.com) (set `RESEND_API_KEY`)
- Server-rendered via the Astro Node adapter — runs anywhere Node + a volume is available
- SQLite database (local file or persistent volume) + Cloudflare R2 media via the S3 API

## Quick Start

```bash
git clone https://github.com/milzamsz/astro-emdash-sqlite-r2-starter.git
cd astro-emdash-sqlite-r2-starter
pnpm install
pnpm dev
```

`pnpm dev` runs EmDash's dev server, which boots Astro, runs database migrations, and seeds `seed/seed.json` on first run. Then open:

- Site: **http://localhost:4321**
- Admin: **http://localhost:4321/_emdash/admin**

The first time you open the admin panel, EmDash walks you through creating an owner account. No database config is needed locally — SQLite (`./data/emdash.db`) and local file uploads (`./data/uploads`) work out of the box.

## Make it yours

After clicking **Use this template**, update these:

- [ ] `src/config/site.config.ts` — `url`, `name`, `description`, `author`, `email`, social links, OG image. Single source of truth (canonical/OG/sitemap/`llms.txt`; `astro.config.ts` reads `url`).
- [ ] `src/config/nav.config.ts` — footer GitHub/social URLs.
- [ ] `astro.config.ts` — Starlight `editLink.baseUrl` and the GitHub social link.
- [ ] `seed/seed.json` — starter collections and content (or edit everything in the admin panel after first run).
- [ ] `public/favicon.svg`, logos, and the default OG image.
- [ ] `.env.example` → `.env`; set `SITE_URL`. R2 credentials are only needed in production.
- [ ] `LICENSE` copyright holder and `CHANGELOG.md`.

> Tip: search for `your-org`, `Your Name`, `your.email@example.com`, and `yourhandle` to find placeholders.

## Documentation

| Document | Purpose |
|----------|---------|
| [SETUP.md](SETUP.md) | Local setup, seeding, and Dokploy deployment |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow and conventions |
| [SECURITY.md](SECURITY.md) | Reporting vulnerabilities |
| [CHANGELOG.md](CHANGELOG.md) | Release notes |
| `/docs` (Starlight) | In-app guides: getting started, content, i18n, deployment |

## Scripts

```bash
pnpm dev         # start EmDash + Astro dev server (auto-migrate + seed)
pnpm build       # production build to dist/ (server output)
pnpm start       # run the built Node server (dist/server/entry.mjs)
pnpm preview     # preview the production build
pnpm types:cms   # regenerate EmDash collection types
pnpm export-seed # export current CMS content back to a seed file
pnpm lint        # eslint + stylelint + type-check + validations
pnpm test        # unit tests (vitest)
pnpm test:e2e    # end-to-end tests (playwright)

# Maintenance (operate on an existing database)
pnpm set-site-url https://your-domain   # set the stored emdash:site_url (email links)
pnpm set-url-patterns                    # apply collection urlPattern values to an old DB
```

## Content model

The **blog** and **pages** collections are owned by EmDash and live in SQLite. Routes
read them at request time through the adapter in `src/lib/cms.ts`, which shapes EmDash
records into the types the Astro components already expect, and renders rich content
with `<PortableText>`. Collection schemas and starter content are defined in
`seed/seed.json`.

Pages are built from **typed fields** — `hero_title`/`hero_subtitle`, a `features`
repeater (rows of title/description/icon), and `cta_*` fields — so editors get real
inputs in the admin instead of a JSON box. Each collection also declares a `urlPattern`
(`/{slug}` for pages, `/blog/{slug}` for posts) that drives the admin's "View on site"
link and sitemaps. Media is uploaded to R2 and served through EmDash's same-origin proxy
route, so the bucket can stay private. See the in-app docs at `/docs/guides/content-management`.

Other content (docs, services, stack, settings) still lives in `src/content` as
Markdown/JSON, type-checked via content collection schemas.

## Deployment

Server-rendered Astro on a Node host. The included `Dockerfile` builds a standalone
server; deploy it to **Dokploy** with a persistent volume mounted at `/app/data` and R2
credentials set as environment variables. The Node adapter serves assets uncompressed, so
enable **gzip/Brotli at the Traefik proxy** for best Lighthouse scores. See
[SETUP.md](SETUP.md) and `/docs/deployment/dokploy`.

## License

[MIT](LICENSE)
