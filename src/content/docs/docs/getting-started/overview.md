---
title: Overview
description: What this starter template provides and how it's built.
sidebar:
  order: 1
---

A production-ready marketing, blog, and docs site built with **Astro** and the **EmDash CMS**. The blog and pages are authored in the EmDash admin panel and stored in SQLite; the site is server-rendered and self-hosts on Dokploy.

## Features

- **EmDash CMS** — blog and pages authored in an admin panel, rendered from Portable Text
- **English-first, multilanguage-ready** — i18n engine wired so you can add locales anytime
- **Server-rendered** — Astro Node adapter; runs anywhere Node + a volume is available
- **Docs** — Starlight-powered documentation with full-text search
- **SEO** — JSON-LD structured data, sitemaps, Open Graph meta, `robots.txt`, and dynamic `llms.txt`

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | [Astro](https://astro.build) v7 (server output, Node adapter) |
| CMS | [EmDash](https://github.com/emdash-cms/emdash) |
| Database | SQLite |
| Docs | [Starlight](https://starlight.astro.build) |
| Styling | [Tailwind CSS](https://tailwindcss.com) v4 |
| Hosting | [Dokploy](https://dokploy.com) (Docker) |
| Media | [Cloudflare R2](https://developers.cloudflare.com/r2/) (S3 API) |

## Next Steps

Read the [Quick Start](../getting-started/quick-start) guide to get the project running locally.
