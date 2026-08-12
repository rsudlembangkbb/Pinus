# Build context: repository root (pnpm workspace needs the whole monorepo
# to resolve the @pinus/shared workspace dependency). On Railway, set
# "Dockerfile Path" to apps/api/Dockerfile with the repo root as context.
FROM node:20-slim AS build
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @pinus/api... --filter @pinus/shared

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN pnpm --filter @pinus/shared build
RUN pnpm --filter @pinus/api exec prisma generate
RUN pnpm --filter @pinus/api build

WORKDIR /repo/apps/api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
