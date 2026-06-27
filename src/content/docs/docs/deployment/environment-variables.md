---
title: Environment Variables
description: Environment configuration for local dev and production.
sidebar:
  order: 2
---

Local development needs no configuration — SQLite and local file storage work out of
the box. Production needs the site URL and (optionally) Cloudflare R2 credentials. See
`.env.example` for the full list.

## Local Development

Copy `.env.example` to `.env`. Only `SITE_URL` matters for correct canonical/OG/sitemap
URLs; the database and uploads default to `./data`.

```ini
SITE_URL=http://localhost:4321

# Optional analytics
PUBLIC_GA_MEASUREMENT_ID=
PUBLIC_GTM_ID=
```

## Production

Set these in your Dokploy service's **Environment** settings.

| Variable | Required | Purpose |
| --- | --- | --- |
| `SITE_URL` | recommended | Public production origin (passkey RP origin) |
| `DATABASE_URL` | no | SQLite path; defaults to `file:./data/emdash.db` |
| `S3_ENDPOINT` | yes | R2 S3 endpoint `https://<accountid>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | yes | R2 bucket name |
| `S3_ACCESS_KEY_ID` | yes | R2 access key (secret) |
| `S3_SECRET_ACCESS_KEY` | yes | R2 secret key (secret) |
| `S3_REGION` | no | Defaults to `auto` (R2) |
| `S3_PUBLIC_URL` | no | Public bucket/CDN domain serving media |
| `RESEND_API_KEY` | for email | Resend API key; presence registers the email provider (secret) |
| `EMAIL_FROM` | for email | Verified sender, e.g. `My Site <noreply@example.com>` |

Store the `S3_*` and `RESEND_API_KEY` values as encrypted secrets, never in the repo.

## Media storage (Cloudflare R2)

In production the site stores media in R2 via the S3-compatible API. The
`@aws-sdk/client-s3` / `@aws-sdk/s3-request-presigner` packages are bundled, and the
storage adapter resolves all `S3_*` values from the environment **at container start**
(`astro.config.ts` calls `s3()` with no arguments). So the `S3_*` vars above are
required at runtime in production — without them, uploads fail with
`MISSING_S3_CONFIG`. Local dev uses the filesystem (`./data/uploads`) unless
`S3_BUCKET` is set in your shell.

Note: switching to R2 does not migrate files already uploaded to the local volume —
re-upload any earlier assets so they get R2 URLs.

## Email (Resend)

EmDash needs an email provider to send magic-link logins, team invites, account
recovery, and notifications. This starter ships a small HTTP-based Resend provider
(`src/emdash/resend-email.ts`).

Set `RESEND_API_KEY` and `EMAIL_FROM` in production. When the key is present the
provider is registered, and because it is the only email provider EmDash selects it
automatically — no admin-dashboard configuration is required. Create a key and verify
your sending domain at [resend.com](https://resend.com). Leave `RESEND_API_KEY` empty
to fall back to copy-link invites.

> The first owner account is still created with a passkey over HTTPS. Email is needed
> for inviting additional users and for magic-link logins thereafter.

## Site URL & outbound links

There are two separate notions of "site URL":

- `SITE_URL` (env) — used for canonical/OG/sitemap URLs and, importantly, as the
  **passkey relying-party origin**. Set it to your full public origin, e.g.
  `https://your-domain.example` (scheme required, no trailing slash). Behind a reverse
  proxy this must be set or passkey verification fails.
- `emdash:site_url` (database) — written **once during the setup wizard** from
  whatever origin the browser used, and used to build **outbound email links**
  (magic-link logins, invites, recovery). The `SITE_URL` env does not override it.

If you completed setup on a temporary domain (for example a `*.sslip.io` host), the
emails will link there. Fix the stored value on the canonical domain with:

```bash
# locally
pnpm set-site-url https://your-domain.example

# inside the container (Dokploy terminal)
cd /app && pnpm set-site-url https://your-domain.example
```

The new value is read on the next send, so no restart is needed. To avoid this
recurring, remove any auto-generated `*.sslip.io` domain from the app and always
access the admin via your canonical domain.

## Secrets Validation

The `validate:secrets` script scans the repo for accidentally committed secrets:

```bash
pnpm run validate:secrets
```

It runs during CI and fails the build if a likely secret is detected.
