import { defineConfig, envField } from "astro/config";
import node from "@astrojs/node";
import starlight from "@astrojs/starlight";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import icon from "astro-icon";
import emdash, { local, s3 } from "emdash/astro";
import { sqlite } from "emdash/db";
import { readdir, readFile } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { siteConfig } from "./src/config/site.config";

// Database: SQLite everywhere. Locally this is a file in ./data; on Dokploy the
// same path is backed by a persistent volume. Override with DATABASE_URL.
const databaseUrl = process.env.DATABASE_URL ?? "file:./data/emdash.db";

// Media storage: in production (the Docker/Dokploy image build sets
// NODE_ENV=production) use S3-compatible storage for Cloudflare R2. `s3()`
// resolves every S3_* value from the environment WHEN THE CONTAINER STARTS
// (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION,
// S3_PUBLIC_URL), so credentials must NOT be read here — astro.config runs at
// build time, where runtime env vars are absent (reading them here is exactly
// why media previously fell back to local). In local dev it uses the
// filesystem unless S3_BUCKET is present in the shell environment.
const useS3 =
  process.env.NODE_ENV === "production" || Boolean(process.env.S3_BUCKET);
const emdashStorage = useS3
  ? s3()
  : local({
      directory: "./data/uploads",
      baseUrl: "/_emdash/api/media/file",
    });

// Email provider: always compile the Resend transport into the build. Whether
// it actually registers the email:deliver hook is decided at runtime inside the
// plugin based on RESEND_API_KEY / EMAIL_FROM (see src/emdash/resend-email.ts) —
// this must NOT be gated here, because astro.config runs at build time (in the
// Docker image build) where runtime env vars are not yet present. When the env
// is set, EmDash auto-selects the sole provider; otherwise it falls back to
// copy-link invites (and the dev console in `astro dev`).
const resendPluginEntry = fileURLToPath(
  new URL("./src/emdash/resend-email.ts", import.meta.url),
).replace(/\\/g, "/");

const emdashPlugins = [
  {
    id: "resend-email",
    version: "1.0.0",
    capabilities: ["hooks.email-transport:register"],
    entrypoint: resendPluginEntry,
  },
];

// EmDash sets a strict `connect-src 'self'` CSP on /_emdash routes (prod only)
// with no allowlist option. That blocks the browser from PUTting media to the
// presigned Cloudflare R2 URL, so uploads stay stuck "pending". This integration
// registers an outermost (`order: "pre"`, declared before emdash() below) middleware
// that appends the R2 origin (from S3_ENDPOINT) to connect-src at runtime.
const emdashCspEntry = fileURLToPath(
  new URL("./src/middleware/emdash-csp.ts", import.meta.url),
).replace(/\\/g, "/");

function emdashCspIntegration() {
  return {
    name: "emdash-csp-connect-src",
    hooks: {
      "astro:config:setup": ({
        addMiddleware,
      }: {
        addMiddleware: (params: { entrypoint: string; order: "pre" | "post" }) => void;
      }) => {
        addMiddleware({ entrypoint: emdashCspEntry, order: "pre" });
      },
    },
  };
}

async function collectFiles(dir: string, extensions: string[]): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectFiles(path, extensions)));
      continue;
    }

    if (extensions.includes(extname(entry.name))) {
      results.push(path);
    }
  }

  return results;
}

function parseFrontmatter(source: string) {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  return match[1].split(/\r?\n/).reduce<Record<string, string>>((acc, line) => {
    const pair = line.match(/^\s*([A-Za-z0-9_-]+):\s*(.*)\s*$/);
    if (!pair) return acc;
    acc[pair[1]] = pair[2].replace(/^["']|["']$/g, "");
    return acc;
  }, {});
}

function validateDuplicates(entries: Array<{ id: string; data?: { uid?: string; locale?: string } }>, supportedLocales: string[]) {
  const seenIds = new Set<string>();
  const seenUids = new Map<string, string>();

  for (const entry of entries) {
    if (seenIds.has(entry.id)) {
      console.warn(`[content-validation] Duplicate slug detected: "${entry.id}"`);
    } else {
      seenIds.add(entry.id);
    }

    const uid = entry.data?.uid;
    if (uid) {
      const previous = seenUids.get(uid);
      if (previous) {
        console.warn(`[content-validation] Duplicate uid detected: "${uid}" (${previous} and ${entry.id})`);
      } else {
        seenUids.set(uid, entry.id);
      }
    }

    const locale = entry.data?.locale;
    if (locale && !supportedLocales.includes(locale)) {
      console.warn(`[content-validation] Unsupported locale "${locale}" on entry "${entry.id}"`);
    }
  }
}

function contentValidationIntegration() {
  return {
    name: "content-validation",
    hooks: {
      "astro:build:start": async () => {
        const contentBase = join(process.cwd(), "src", "content");
        const collections = [
          { dir: join(contentBase, "blog"), extensions: [".md", ".mdx"] },
          { dir: join(contentBase, "services"), extensions: [".md", ".mdx"] },
          { dir: join(contentBase, "pages"), extensions: [".md"] },
          { dir: join(contentBase, "faqs"), extensions: [".json"] },
          { dir: join(contentBase, "stack"), extensions: [".md", ".mdx"] },
        ];

        const entries = await Promise.all(
          collections.map(async ({ dir, extensions }) =>
            Promise.all(
              (await collectFiles(dir, extensions)).map(async (file) => ({
                id: basename(file).replace(/\.[^/.]+$/, ""),
                data: parseFrontmatter(await readFile(file, "utf8")),
              })),
            ),
          ),
        );

        const supportedLocales = ["en"];
        for (const collection of entries) {
          validateDuplicates(collection, supportedLocales);
        }
      },
    },
  };
}

export default defineConfig({
  site: siteConfig.url,
  // EmDash renders content on demand from the database, so the site runs as a
  // server (Node standalone) rather than a fully static build.
  output: "server",
  adapter: node({ mode: "standalone" }),
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
    prefixDefaultLocale: false,
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },
  integrations: [
    // Registered first so its `pre` middleware is the outermost in the chain and
    // runs its post-next() CSP patch AFTER EmDash's auth middleware sets the CSP.
    emdashCspIntegration(),
    emdash({
      database: sqlite({ url: databaseUrl }),
      storage: emdashStorage,
      plugins: emdashPlugins,
    }),
    starlight({
      title: siteConfig.name,
      customCss: ["./src/styles/starlight.css"],
      components: {
        SiteTitle: "./src/components/docs/SiteTitle.astro",
      },
      editLink: {
        baseUrl: "https://github.com/milzamsz/astro-emdash-sqlite-r2-starter/edit/main",
      },
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/milzamsz/astro-emdash-sqlite-r2-starter" },
      ],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Overview", slug: "docs/getting-started/overview" },
            { label: "Quick Start", slug: "docs/getting-started/quick-start" },
            { label: "Project Structure", slug: "docs/getting-started/project-structure" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Content Management", slug: "docs/guides/content-management" },
            { label: "Internationalization", slug: "docs/guides/internationalization" },
            { label: "Customization", slug: "docs/guides/customization" },
          ],
        },
        {
          label: "Deployment",
          items: [
            { label: "Dokploy (Docker)", slug: "docs/deployment/dokploy" },
            { label: "Environment Variables", slug: "docs/deployment/environment-variables" },
          ],
        },
      ],
    }),
    mdx(),
    contentValidationIntegration(),
    sitemap({
      i18n: {
        defaultLocale: "en",
        locales: {
          en: "en-US",
        },
      },
    }),
    react(),
    icon(),
  ],
  env: {
    schema: {
      SITE_URL: envField.string({ context: "server", access: "public", default: "http://localhost:4321" }),
      GOOGLE_SITE_VERIFICATION: envField.string({ context: "server", access: "public", optional: true }),
      BING_SITE_VERIFICATION: envField.string({ context: "server", access: "public", optional: true }),
      PUBLIC_GA_MEASUREMENT_ID: envField.string({ context: "client", access: "public", optional: true }),
      PUBLIC_GTM_ID: envField.string({ context: "client", access: "public", optional: true }),
      PUBLIC_CONSENT_ENABLED: envField.boolean({ context: "client", access: "public", optional: true, default: false }),
      PUBLIC_PRIVACY_POLICY_URL: envField.string({ context: "client", access: "public", optional: true }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    format: "directory",
  },
  markdown: {
    shikiConfig: {
      theme: "github-dark",
      wrap: true,
    },
  },
  image: {
    layout: "constrained",
  },
  security: {
    checkOrigin: true,
  },
});