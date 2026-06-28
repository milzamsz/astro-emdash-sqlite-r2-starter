import { defineMiddleware } from "astro:middleware";
import { createHash } from "node:crypto";

/**
 * Sends a set of "real" security headers for the PUBLIC site (everything except
 * the EmDash admin under `/_emdash`, which ships its own CSP — see
 * `src/middleware/emdash-csp.ts`).
 *
 * The hard part of a real CSP is inline scripts. This template emits a few:
 *  - the dark-mode bootstrap (`<script is:inline>` in BaseLayout)
 *  - optional analytics (GA / GTM / Umami) snippets
 * Their content is dynamic (analytics IDs) and per-page, so a hand-maintained
 * `script-src` hash list rots immediately. Instead we buffer the HTML response,
 * compute a SHA-256 hash for every executable inline `<script>` actually
 * emitted, and auto-allowlist the origins of any external `<script src>` (GA,
 * GTM, Umami …). The result is a strict, nonce-free CSP that adapts to whatever
 * the page renders — no `'unsafe-inline'` for scripts.
 *
 * `<script type="application/ld+json">` is a data block, not executable, so it
 * is ignored (browsers don't gate it on `script-src`). Inline `style="…"`
 * attributes are common in component output, so `style-src` keeps
 * `'unsafe-inline'` — a far smaller risk surface than scripts.
 *
 * Set DISABLE_SECURITY_HEADERS=1 to turn this off (e.g. when a CDN/proxy already
 * sets these headers).
 */

const DISABLED = process.env.DISABLE_SECURITY_HEADERS === "1";

// Executable inline scripts: opening tag without a `src=` attribute.
const INLINE_SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
// External scripts: `<script ... src="…">`.
const EXTERNAL_SRC_RE = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;

function isJsonLd(attrs: string): boolean {
  return /type\s*=\s*["']application\/(ld\+json|json)["']/i.test(attrs);
}

function hasSrc(attrs: string): boolean {
  return /\bsrc\s*=/.test(attrs);
}

function sha256(content: string): string {
  return `'sha256-${createHash("sha256").update(content, "utf8").digest("base64")}'`;
}

function collectScriptDirectives(html: string): {
  hashes: Set<string>;
  scriptOrigins: Set<string>;
} {
  const hashes = new Set<string>();
  const scriptOrigins = new Set<string>();

  for (const match of html.matchAll(INLINE_SCRIPT_RE)) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    if (hasSrc(attrs)) continue; // external — handled below
    if (isJsonLd(attrs)) continue; // data block, not executed
    if (body.trim() === "") continue;
    hashes.add(sha256(body));
  }

  for (const match of html.matchAll(EXTERNAL_SRC_RE)) {
    const src = match[1] ?? "";
    if (!/^https?:\/\//i.test(src)) continue; // same-origin handled by 'self'
    try {
      scriptOrigins.add(new URL(src).origin);
    } catch {
      // ignore unparseable URLs
    }
  }

  return { hashes, scriptOrigins };
}

function buildCsp(html: string): string {
  const { hashes, scriptOrigins } = collectScriptDirectives(html);

  // Analytics that loads a tag from googletagmanager.com also beacons to
  // google-analytics.com — allow it on connect/img so events aren't dropped.
  const usesGoogleAnalytics = [...scriptOrigins].some((o) =>
    o.includes("googletagmanager.com"),
  );
  const gaHosts = usesGoogleAnalytics
    ? ["https://www.google-analytics.com", "https://region1.google-analytics.com"]
    : [];

  const scriptSrc = ["'self'", ...hashes, ...scriptOrigins].join(" ");
  const connectSrc = ["'self'", ...scriptOrigins, ...gaHosts].join(" ");
  const imgSrc = ["'self'", "data:", "blob:", "https:"].join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    `script-src ${scriptSrc}`,
    // Astro scoped styles are external files, but inline `style=""` attributes
    // are common in component markup, so inline styles stay allowed.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src ${imgSrc}`,
    `connect-src ${connectSrc}`,
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function setStaticHeaders(headers: Headers, isHttps: boolean): void {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  );
  // HSTS only over HTTPS (ignored, but pointless, on plain-HTTP dev).
  if (isHttps) {
    headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  if (DISABLED) return response;
  // EmDash admin manages its own CSP; don't touch it.
  if (context.url.pathname.startsWith("/_emdash")) return response;

  const forwardedProto = context.request.headers.get("x-forwarded-proto");
  const isHttps =
    context.url.protocol === "https:" || forwardedProto === "https";

  const contentType = response.headers.get("content-type") ?? "";
  const isHtml = contentType.includes("text/html");

  // Non-HTML (images, JSON, sitemap, redirects): static headers only, no body
  // buffering and no CSP (which only makes sense for documents).
  if (!isHtml || !response.body) {
    setStaticHeaders(response.headers, isHttps);
    return response;
  }

  const html = await response.text();
  const headers = new Headers(response.headers);
  setStaticHeaders(headers, isHttps);
  headers.set("Content-Security-Policy", buildCsp(html));
  headers.delete("content-length"); // body may be re-encoded by the runtime

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
