FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install
RUN pnpm --dir apps/web build

FROM node:24-alpine AS runner

WORKDIR /app

RUN corepack enable

COPY --from=builder /app /app

EXPOSE 3000

CMD ["pnpm", "--dir", "apps/web", "start"]
