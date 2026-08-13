FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY . .

RUN pnpm install
RUN pnpm --dir apps/api prisma generate
RUN pnpm --dir apps/api build

FROM node:24-alpine AS runner

WORKDIR /app

RUN corepack enable

COPY --from=builder /app /app

EXPOSE 3001

CMD ["sh", "-c", "pnpm --dir apps/api prisma db push && pnpm --dir apps/api prisma:seed && node apps/api/dist/main"]
