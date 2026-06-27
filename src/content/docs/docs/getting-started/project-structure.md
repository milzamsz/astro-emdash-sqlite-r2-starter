---
title: Project Structure
description: How the project is organised and where to find key files.
sidebar:
  order: 3
---

```
.
├── public/
│   └── favicon.svg
├── seed/
│   └── seed.json            # EmDash collection schemas + starter content
├── data/                    # SQLite db + local uploads (gitignored; volume in prod)
├── src/
│   ├── components/          # Reusable Astro components (Hero, CTA, FAQ…)
│   ├── content/             # File-based collections (docs, services, stack, settings)
│   ├── i18n/                # Internationalisation utilities (routes, switcher, UI)
│   ├── layouts/             # Base layout with SEO, analytics, navigation
│   ├── lib/                 # Shared libraries (cms adapter, analytics, SEO, site config)
│   ├── pages/               # Astro pages with locale routing (+ llms.txt, robots.txt, rss)
│   ├── styles/              # Global CSS and Tailwind layers
│   ├── content.config.ts    # File-based content collection schemas
│   └── live.config.ts       # EmDash live collection registration
├── .github/workflows/       # CI/CD workflows
├── astro.config.ts          # Astro + EmDash + Node adapter + Starlight config
├── Dockerfile               # Standalone Node server image for Dokploy
└── package.json
```

## Key Patterns

- **CMS content**: blog and pages live in EmDash (SQLite), read at request time via `src/lib/cms.ts` and rendered with `<PortableText>`.
- **Locale routing**: default-locale routes live at the root; add `src/pages/[locale]/` routes when introducing more languages.
- **File-based collections**: Markdown in `src/content/` (docs, services, stack) with a `locale` frontmatter field.
- **Server output**: the site is server-rendered via the Astro Node adapter and deployed as a Docker container.
