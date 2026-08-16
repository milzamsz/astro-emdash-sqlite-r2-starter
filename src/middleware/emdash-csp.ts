import { defineMiddleware } from "astro:middleware";

/**
 * Widen EmDash's admin Content-Security-Policy so browser uploads can reach
 * Cloudflare R2.
 *
 * EmDash hard-codes `connect-src 'self'` on `/_emdash` responses in production
 * (see emdash `buildEmDashCsp`), with no option to allowlist an S3/R2 endpoint.
 * Media uploads use presigned URLs that the browser PUTs directly to R2, so the
 * strict CSP blocks them ("Refused to connect ... violates connect-src 'self'")
 * and uploads get stuck in the `pending` state.
 *
 * This middleware is registered as `order: "pre"` BEFORE the EmDash integration,
 * which makes it the outermost middleware: its post-`next()` code runs after
 * EmDash sets the CSP, so it can append the R2 origin to `connect-src`.
 *
 * The allowed origin is derived from `S3_ENDPOINT` at runtime (presigned URLs
 * are path-style: `https://<account>.r2.cloudflarestorage.com/<bucket>/...`).
 */
function extraConnectSrcOrigins(): string[] {
  const origins = new Set<string>();
  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) {
    try {
      origins.add(new URL(endpoint).origin);
    } catch {
      // Ignore an unparseable endpoint; CSP stays unchanged.
    }
  }
  return [...origins];
}

const EXTRA_ORIGINS = extraConnectSrcOrigins();

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  if (EXTRA_ORIGINS.length === 0) return response;
  if (!context.url.pathname.startsWith("/_emdash")) return response;

  const csp = response.headers.get("content-security-policy");
  if (!csp || !csp.includes("connect-src")) return response;

  const patched = csp.replace(
    /connect-src ([^;]*)/,
    (_match, value: string) => {
      const additions = EXTRA_ORIGINS.filter(
        (origin) => !value.includes(origin),
      );
      return additions.length
        ? `connect-src ${value} ${additions.join(" ")}`
        : `connect-src ${value}`;
    },
  );

  response.headers.set("content-security-policy", patched);
  return response;
});
