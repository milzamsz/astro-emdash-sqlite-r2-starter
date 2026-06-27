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
| `SITE_URL` | recommended | Public production URL |
| `DATABASE_URL` | no | SQLite path; defaults to `file:./data/emdash.db` |
| `S3_ENDPOINT` | for R2 | R2 S3 endpoint `https://<accountid>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | for R2 | R2 bucket name (its presence switches storage to R2) |
| `S3_ACCESS_KEY_ID` | for R2 | R2 access key (secret) |
| `S3_SECRET_ACCESS_KEY` | for R2 | R2 secret key (secret) |
| `S3_REGION` | no | `auto` for R2 |
| `S3_PUBLIC_URL` | no | Public CDN/custom domain serving media |
| `RESEND_API_KEY` | for email | Resend API key; presence registers the email provider (secret) |
| `EMAIL_FROM` | for email | Verified sender, e.g. `My Site <noreply@example.com>` |

Store the `S3_*` and `RESEND_API_KEY` values as encrypted secrets, never in the repo.

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

## Secrets Validation

The `validate:secrets` script scans the repo for accidentally committed secrets:

```bash
pnpm run validate:secrets
```

It runs during CI and fails the build if a likely secret is detected.
