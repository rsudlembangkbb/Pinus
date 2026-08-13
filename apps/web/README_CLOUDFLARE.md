# Cloudflare Worker Setup

Frontend PINUS sudah disiapkan untuk deploy ke Cloudflare Workers menggunakan OpenNext.

## File yang Sudah Disiapkan

- `open-next.config.ts`
- `wrangler.jsonc`
- `.dev.vars.example`

## Install

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

## Preview Runtime Cloudflare

```bash
pnpm preview
```

## Deploy

```bash
pnpm deploy
```

## Environment

Set variable berikut di Cloudflare:

```env
NEXT_PUBLIC_API_URL=https://api-pinus.domain-anda.go.id
```
