# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.0] — 2026-08-17

### Overview

Major dependency update across the entire stack — npm packages, GitHub
Actions, and pnpm. All 14 open Dependabot PRs were consolidated into a
single coordinated update, then all pre-existing lint, formatting, and
E2E test failures were resolved.

### 🔧 Dependencies — npm packages

#### Production dependencies

| Package | Old version | New version | Notes |
|---------|------------|-------------|-------|
| astro | 7.0.2 | 7.2.2 | Patch/minor bumps within v7 |
| emdash | 0.23.0 | 0.33.0 | 10 minor versions; no breaking API changes. **Not** bumped to 1.0.0 (deprecated on npm) |
| @astrojs/mdx | 7.0.0 | 7.0.5 | |
| @astrojs/node | 11.0.0 | 11.1.2 | |
| @astrojs/react | 6.0.0 | 6.0.2 | |
| @astrojs/rss | 4.0.18 | 4.0.19 | |
| @aws-sdk/client-s3 | 3.1075.0 | 3.1111.0 | |
| @aws-sdk/s3-request-presigner | 3.1075.0 | 3.1111.0 | |
| sharp | 0.35.2 | 0.35.3 | |
| tailwindcss | 4.3.1 | 4.3.3 | |
| tailwind-merge | 3.2.0 | 3.6.0 | |
| zod | 4.4.1 | 4.4.3 | |
| cva | 1.0.0-beta.4 | 1.0.0-beta.8 | |
| @fontsource-variable/jetbrains-mono | 5.2.0 | 5.3.0 | |
| @fontsource-variable/manrope | 5.2.0 | 5.3.0 | |
| @fontsource-variable/outfit | 5.2.0 | 5.3.0 | |
| @iconify-json/lucide | 1.2.114 | 1.2.123 | |
| @iconify-json/simple-icons | 1.2.87 | 1.2.93 | |
| @tailwindcss/vite | 4.3.1 | 4.3.3 | |
| better-sqlite3 | 12.8.0 | 12.8.0 | **Unchanged** — emdash 0.33 requires 12.x as peer dep |

#### Dev dependencies

| Package | Old version | New version | Notes |
|---------|------------|-------------|-------|
| vitest | 3.2.6 | 4.1.10 | Major version; no config changes needed — all 35 tests pass |
| eslint | 10.5.0 | 10.8.1 | |
| eslint-plugin-astro | 2.1.1 | 3.1.0 | Major version; now uses Rust compiler |
| astro-eslint-parser | 2.1.0 | 3.1.0 | Major version |
| typescript-eslint | 8.62.0 | 8.67.0 | |
| @typescript-eslint/eslint-plugin | 8.62.0 | 8.67.0 | |
| @typescript-eslint/parser | 8.62.0 | 8.67.0 | |
| @astrojs/check | 0.9.9 | 0.9.10 | |
| @astrojs/starlight | 0.41.0 | 0.41.7 | |
| @types/node | 20.0.0 | 24.0.0 | Matched to Node 24 runtime |
| @types/react | 19.1.0 | 19.2.18 | |
| @types/react-dom | 19.4.4 | 19.2.4 | Corrected (Dependabot proposed ^26) |
| @playwright/test | 1.53.0 | 1.62.1 | |
| globals | 17.7.0 | 17.11.0 | |
| prettier | 3.9.0 | 3.9.6 | |
| prettier-plugin-tailwindcss | 0.8.0 | 0.8.1 | |
| stylelint | 17.14.0 | 17.14.1 | |
| typescript | 6.0.3 | 6.0.3 | **Unchanged** — TS 7.0 incompatible with ecosystem (typescript-eslint peer caps at <6.1.0, @astrojs/language-server crashes) |

#### Deliberately not upgraded

| Package | Current | Considered | Reason |
|---------|---------|------------|--------|
| typescript | 6.0.3 | 7.0 | `typescript-eslint` peer dep caps at `<6.1.0`; `@astrojs/language-server` crashes |
| better-sqlite3 | 12.8.0 | 13.x | emdash 0.33 requires `^12.8.0` as peer dep |
| emdash | 0.33.0 | 1.0.0 | 1.0.0 is **deprecated** on npm; 0.33.0 is the latest stable |

### 🔧 Dependencies — Package manager

| Tool | Old version | New version | Notes |
|------|------------|-------------|-------|
| pnpm | 8.15.0 | 10.34.5 | Major upgrade; pnpm 10 requires explicit build script approval via `pnpm-workspace.yaml` |

Added `pnpm-workspace.yaml` with `onlyBuiltDependencies` config for
`better-sqlite3` and `esbuild` (native modules requiring postinstall
build scripts).

### 🔧 Dependencies — GitHub Actions

| Action | Old version | New version |
|--------|------------|-------------|
| actions/setup-node | v6 | v7 |
| docker/login-action | v3 | v4 |
| docker/metadata-action | v5 | v6 |
| docker/build-push-action | v6 | v7 |

Applied to `ci.yml`, `release.yml`, and `skills-verification.yml`.

### 🐛 Bug fixes

#### Docker build — `better-sqlite3` native module binding

The pnpm 8→10 upgrade changed how native module build scripts are
approved. The `pnpm-workspace.yaml` file (which configures
`onlyBuiltDependencies`) was not copied into the Docker image's
dependency stage, so `pnpm install --frozen-lockfile` skipped the
`better-sqlite3` build script and the native `.node` binding was never
compiled.

This caused "Could not locate the bindings file" errors at runtime,
making the EmDash CMS database inaccessible — all CMS-driven pages
(blog, about, etc.) rendered empty in production.

**Fix:** Added `pnpm-workspace.yaml` to the Dockerfile's deps stage
`COPY` instruction.

#### Stylelint — 6 pre-existing CSS errors resolved

- `global.css`: Replaced deprecated `word-break: break-word` with
  `overflow-wrap: break-word` (per
  `declaration-property-value-keyword-no-deprecated`)
- `global.css`, `starlight.css`: Auto-fixed
  `media-feature-range-notation` violations
- `starlight.css`: Auto-fixed `comment-empty-line-before` violations

#### Prettier — 20 files reformatted

20 `.astro` / `.ts` / `.css` files were reformatted to match the
Prettier configuration.

#### E2E tests — 6 pre-existing test failures resolved

| Test | Root cause | Fix |
|------|-----------|-----|
| Blog share buttons | Test targeted the hidden native-share button (no `navigator.share` in headless Chrome) | Updated selector to `.share-buttons__btn:visible` |
| Contact form (3 tests) | Contact page was redesigned — no `#contact-form`, now uses email button + map | Rewrote tests to verify contact info section, mailto link, and map/placeholder |
| Language switcher | Switcher only renders with 2+ locales; starter ships with `["en"]` only | Test now skips gracefully when single locale configured |
| Services detail page | `RenderUndefinedEntryError` — `render()` needs static rendering in server output mode | Added `export const prerender = true` to `services/[slug].astro` |

### 🔧 Maintenance

- Added `test-results/` and `.hermes/` to `.gitignore`
- All 14 Dependabot PRs (#7–#26) closed with branches deleted
- Consolidated PRs: #27 (deps), #28 (lint/format/e2e), #29 (Dockerfile fix)

### ✅ Verification

| Check | Status |
|-------|--------|
| Unit tests | 35 passed |
| Type-check | 0 errors |
| Lint:JS | 0 errors |
| Lint:CSS | 0 errors |
| Format:check | All clean |
| Build | Passes |
| E2E tests | 12 passed, 1 skipped, 0 failed |

## [1.0.0] — 2026-06-27

Initial public template release.

### Highlights

- Astro 7 + TypeScript, Tailwind CSS v4, monochrome OKLCH design tokens
- Bilingual content (English / Indonesian) with prefix-based i18n routing
- Git-based content (Markdown) — no CMS or database
- Marketing pages, blog, and Starlight docs with Pagefind search
- Cloudflare Pages hosting with optional R2 media + secret-guarded cleanup worker
- SEO: canonical, hreflang, JSON-LD, Open Graph, sitemap, RSS, dynamic `llms.txt`
- Static contact page (mailto + OpenStreetMap embed)
