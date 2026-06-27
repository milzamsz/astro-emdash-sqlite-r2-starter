---
title: Quick Start
description: Get the project running locally in minutes.
sidebar:
  order: 2
---

## Prerequisites

- **Node.js 24+** (use [fnm](https://github.com/Schniz/fnm) or [nvm](https://github.com/nvm-sh/nvm))
- **pnpm 8.15+** (`corepack enable && corepack prepare pnpm@8.15.0 --activate`)
- A Cloudflare R2 bucket (only for production media)

## Clone & Install

```bash
git clone https://github.com/milzamsz/astro-emdash-sqlite-r2-starter.git
cd astro-emdash-sqlite-r2-starter
pnpm install
```

## Environment Setup

```bash
cp .env.example .env   # optional locally
```

Local dev needs no configuration — SQLite (`./data/emdash.db`) and local uploads work
out of the box. Set `SITE_URL` for correct canonical/OG/sitemap URLs in production.

## Run Development Server

```bash
pnpm dev
```

This runs EmDash's dev server: it boots Astro, migrates the SQLite database, and seeds
`seed/seed.json` on first run.

- Site: `http://localhost:4321` — English at the root (`/`)
- Admin: `http://localhost:4321/_emdash/admin` — create the owner account on first visit

## Build for Production

```bash
pnpm build   # server build in dist/
pnpm start   # run node ./dist/server/entry.mjs
```

Deploy the server with the included `Dockerfile`. See [Dokploy (Docker)](/docs/deployment/dokploy/).
