import { getCollection, type CollectionEntry } from "astro:content";
import { siteConfig } from "../../config/site.config";
import { getPage, getPostEntry } from "../../lib/cms";

type OgKind =
  "home" | "page" | "blog" | "service" | "blog-list" | "services-list";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(value: string, limit = 110) {
  return value.length > limit
    ? `${value.slice(0, limit - 1).trimEnd()}…`
    : value;
}

function svgTemplate({
  kind,
  title,
  description,
  accent,
}: {
  kind: OgKind;
  title: string;
  description: string;
  accent: string;
}) {
  const altAccent =
    kind === "home"
      ? siteConfig.branding.colors.secondary
      : siteConfig.branding.colors.accent;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accent}" />
      <stop offset="100%" stop-color="${altAccent}" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <circle cx="980" cy="120" r="180" fill="rgba(255,255,255,0.08)" />
  <circle cx="1120" cy="540" r="220" fill="rgba(255,255,255,0.06)" />
  <circle cx="140" cy="530" r="190" fill="rgba(255,255,255,0.06)" />
  <text x="80" y="92" fill="rgba(255,255,255,0.82)" font-size="28" font-family="Inter, Arial, sans-serif" font-weight="700">${escapeXml(siteConfig.name)}</text>
  <text x="80" y="270" fill="#ffffff" font-size="64" font-family="Inter, Arial, sans-serif" font-weight="800">${escapeXml(title)}</text>
  <text x="80" y="350" fill="rgba(255,255,255,0.9)" font-size="30" font-family="Inter, Arial, sans-serif" font-weight="500">${escapeXml(truncate(description, 120))}</text>
  <text x="80" y="560" fill="rgba(255,255,255,0.72)" font-size="22" font-family="Inter, Arial, sans-serif">${escapeXml(siteConfig.url.replace(/^https?:\/\//, ""))}</text>
</svg>`;
}

function isOgKind(value: string): value is OgKind {
  return [
    "home",
    "page",
    "blog",
    "service",
    "blog-list",
    "services-list",
  ].includes(value);
}

async function resolveMeta(kind: OgKind, idOrSlug: string) {
  if (kind === "blog-list") {
    return {
      title: "Blog",
      description: "Articles about web development and the modern stack.",
      accent: siteConfig.branding.colors.primary,
    };
  }

  if (kind === "services-list") {
    return {
      title: "Services",
      description: "Modern website development services.",
      accent: siteConfig.branding.colors.secondary,
    };
  }

  if (kind === "blog") {
    const detail = await getPostEntry(idOrSlug);
    return {
      title: detail?.post.data.title ?? siteConfig.name,
      description: detail?.post.data.description ?? siteConfig.description,
      accent: siteConfig.branding.colors.primary,
    };
  }

  if (kind === "service") {
    const services = await getCollection("services");
    const service = services.find(
      (entry: CollectionEntry<"services">) => entry.data.slug === idOrSlug,
    );
    return {
      title: service?.data.title ?? siteConfig.name,
      description: service?.data.description ?? siteConfig.description,
      accent: siteConfig.branding.colors.secondary,
    };
  }

  if (kind === "page") {
    const page = await getPage(idOrSlug);
    return {
      title: page?.data.title ?? siteConfig.name,
      description: page?.data.description ?? siteConfig.description,
      accent: siteConfig.branding.colors.accent,
    };
  }

  return {
    title: siteConfig.name,
    description: siteConfig.description,
    accent: siteConfig.branding.colors.primary,
  };
}

export async function GET({ params }: { params: { slug?: string } }) {
  // Slug shapes (set by SEO components):
  //   home/<locale>, blog-list/<locale>, services-list/<locale>
  //   blog/<locale>/<id>, service/<locale>/<slug>, page/<locale>/<slug>
  const parts = (params.slug ?? "home/en").split("/").filter(Boolean);
  const kind = isOgKind(parts[0] ?? "") ? (parts[0] as OgKind) : "home";
  const idOrSlug = parts[2] ?? "";

  const meta = await resolveMeta(kind, idOrSlug);

  return new Response(
    svgTemplate({
      kind,
      title: meta.title,
      description: meta.description,
      accent: meta.accent,
    }),
    {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
