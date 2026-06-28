---
title: Content Management
description: How to manage content with the EmDash CMS and Markdown.
sidebar:
  order: 1
---

The **blog** and **pages** collections are managed in the [EmDash](https://github.com/emdash-cms/emdash)
CMS and stored in SQLite. Other content (docs, services, stack, settings) still lives as
Markdown/JSON in `src/content`.

## CMS collections (EmDash)

| Collection | Description | Source |
| --- | --- | --- |
| **Blog** | Articles and news posts | EmDash (SQLite) |
| **Pages** | Marketing/legal pages (about, contact, pricing, privacy, terms) | EmDash (SQLite) |

Author these in the admin panel at `/_emdash/admin`. Routes read EmDash at request time
through `src/lib/cms.ts`, which adapts records into the shapes the Astro components expect
and renders rich text with `<PortableText>`. Collection schemas and starter content are
defined in `seed/seed.json`.

- Run `pnpm types:cms` after changing a collection schema to refresh generated types.
- Run `pnpm export-seed` to snapshot current CMS content back into a seed file.

### Public routes & the "View on site" link

Each collection declares a `urlPattern` in `seed/seed.json` that maps an entry to its
public route. This drives the admin's **View on site** link, sitemaps, menus, and
redirects:

| Collection | `urlPattern` | Example |
| --- | --- | --- |
| **Pages** | `/{slug}` | `contact` → `/contact` |
| **Posts** | `/blog/{slug}` | `welcome` → `/blog/welcome` |

Without a `urlPattern`, EmDash falls back to `/{collection}/{slug}` (e.g. `/pages/contact`),
which has no matching route here. Fresh installs pick these up from the seed automatically.
For a database that was seeded before these patterns existed, apply them once and restart:

```bash
# locally
pnpm set-url-patterns

# inside the container (Dokploy terminal), then restart the service
cd /app && pnpm set-url-patterns
```

> The bundled page routes (`/about`, `/contact`, `/pricing`, `/privacy`, `/terms`) are the
> ones wired to the `pages` collection. A page created in the admin with a different slug
> needs a matching Astro route to render.

## File-based collections (Markdown/JSON)

| Collection | Description | Files |
| --- | --- | --- |
| **Services** | Service offerings with pricing | `src/content/services/*.md` |
| **Stack** | Technology stack entries | `src/content/stack/*.md` |
| **Docs** | Documentation pages | `src/content/docs/**` (Starlight) |

Schemas are defined in `src/content.config.ts`, so frontmatter is type-checked.

## Locale Convention

The starter is English-first. File-based entries use a plain `<slug>.md` with
`locale: "en"`; add a locale-suffixed copy (e.g. `about.id.md`) for other languages.
EmDash content carries its own locale field. See the
[Internationalization guide](/docs/guides/internationalization/).

## Editing Workflow

- **Blog & pages**: edit in the admin panel — changes are live immediately, no redeploy.
- **Docs/services/stack**: edit Markdown under `src/content`, run `pnpm dev` to preview,
  then commit and open a pull request.

## Media

Editor uploads go to Cloudflare R2 in production (local filesystem in dev). EmDash
serves them through a same-origin proxy route (`/_emdash/api/media/file/<key>`), so the
admin shows that path even though the file lives in R2 — this keeps the bucket private.
Images can also live in `src/assets` to be optimized by Astro at build time.
