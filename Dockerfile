# syntax=docker/dockerfile:1

# ---- Base ----------------------------------------------------------------
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---- Dependencies --------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Build ---------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---- Runtime -------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
# Astro Node standalone server settings.
ENV HOST=0.0.0.0
ENV PORT=4321
# SQLite database + local media live here. Mount a persistent Dokploy volume
# at /app/data so content survives redeploys.
ENV DATABASE_URL=file:./data/emdash.db

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/seed ./seed
COPY package.json ./
COPY docker-entrypoint.sh ./
# Maintenance scripts (e.g. `pnpm set-site-url`) run inside the container.
COPY scripts ./scripts
RUN chmod +x ./docker-entrypoint.sh

RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 4321
# Seeds starter content on a fresh volume, then starts the Astro Node server.
ENTRYPOINT ["./docker-entrypoint.sh"]