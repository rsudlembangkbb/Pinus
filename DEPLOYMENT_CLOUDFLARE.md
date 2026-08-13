# Deploy PINUS Dengan Cloudflare

Dokumen ini menyiapkan arsitektur production yang realistis untuk PINUS:

- Frontend `Next.js` di `Cloudflare Workers` via OpenNext
- Backend `NestJS` di hosting Node/container seperti `Railway`, `Render`, atau `Fly.io`
- Database `PostgreSQL` di `Supabase`
- Domain, proxy, SSL, dan WAF di `Cloudflare`

## Arsitektur Yang Direkomendasikan

### Frontend

- Lokasi: `apps/web`
- Runtime: `Cloudflare Workers`
- Adapter: `@opennextjs/cloudflare`
- Command deploy: `pnpm --dir apps/web deploy`

### Backend

- Lokasi: `apps/api`
- Runtime: Node.js 24+
- Deploy target yang disarankan:
  - Railway
  - Render
  - Fly.io

### Database

- Provider: `Supabase Postgres`
- Gunakan connection string pooled atau direct PostgreSQL sesuai kebutuhan Prisma

## 1. Siapkan Supabase

1. Buat project baru di Supabase.
2. Salin connection string PostgreSQL.
3. Isi environment backend:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres?schema=public
JWT_SECRET=ganti-dengan-secret-produksi
PORT=3001
FRONTEND_URL=https://pinus.your-domain.com
COOKIE_SECURE=true
```

4. Jalankan migrasi/seed pada host backend:

```bash
pnpm install
pnpm --dir apps/api prisma generate
pnpm --dir apps/api prisma db push
pnpm --dir apps/api prisma:seed
```

## 2. Deploy Backend

Deploy `apps/api` ke hosting Node pilihan Anda.

### Build command

```bash
pnpm install && pnpm --dir apps/api prisma generate && pnpm --dir apps/api build
```

### Start command

```bash
pnpm --dir apps/api start:prod
```

### Environment minimum

```env
DATABASE_URL=
JWT_SECRET=
PORT=3001
FRONTEND_URL=https://pinus.your-domain.com
COOKIE_SECURE=true
```

Pastikan endpoint health API bisa diakses, misalnya:

```text
https://api-pinus.your-domain.com/
```

## 3. Deploy Frontend ke Cloudflare

Adapter Cloudflare sudah disiapkan pada file berikut:

- `apps/web/open-next.config.ts`
- `apps/web/wrangler.jsonc`

### Environment frontend

Di Cloudflare, set variable berikut:

```env
NEXT_PUBLIC_API_URL=https://api-pinus.your-domain.com
```

### Command

```bash
pnpm install
pnpm --dir apps/web deploy
```

### Preview lokal runtime Cloudflare

```bash
pnpm --dir apps/web preview
```

## 4. Hubungkan Domain di Cloudflare

Contoh pemisahan domain:

- Frontend: `pinus.domain-anda.go.id`
- Backend API: `api-pinus.domain-anda.go.id`

Tambahkan DNS record pada Cloudflare:

- `CNAME` atau `A` untuk frontend sesuai target deploy
- `CNAME` untuk API ke host backend

Aktifkan:

- SSL/TLS
- Always Use HTTPS
- WAF rules bila diperlukan
- Rate limiting pada endpoint sensitif

## 5. Workers Variables

`apps/web/wrangler.jsonc` sudah memakai:

- `nodejs_compat`
- `WORKER_SELF_REFERENCE`
- asset binding dari `.open-next/assets`

Jika nanti ingin menambah cache lanjutan, bisa tambahkan binding `KV` atau `R2`.

## 6. Login Produksi

Setelah backend aktif dan seed sukses, akun demo default:

- `superadmin`
- `adminjaspel`
- `verifikator`
- `keuangan`
- `direktur`
- `pegawai`
- `auditor`

Password awal:

```text
pinus123
```

Segera ganti password setelah go-live.

## 7. Catatan Penting

- Cloudflare paling cocok dipakai untuk frontend PINUS.
- Backend NestJS tetap lebih aman dijalankan di host Node terpisah.
- Formula final remunerasi masih harus disesuaikan dengan keputusan resmi RSUD sebelum produksi.
