# Panduan Deployment PINUS

PINUS berjalan sepenuhnya di ekosistem serverless Cloudflare:

| Komponen | Layanan Cloudflare | Lokasi kode |
|---|---|---|
| API backend | Workers (Hono) | `apps/api` |
| Database | D1 (SQLite) | `apps/api/migrations` |
| Penyimpanan berkas | R2 | binding `FILES` |
| Frontend | Pages (React SPA) | `apps/web` |

Dokumen ini menjelaskan langkah penyiapan dari nol sampai aplikasi bisa diakses di production.

## 1. Prasyarat

- Akun Cloudflare dengan Workers Paid plan (D1 + R2 tersedia di plan gratis untuk skala kecil, tetapi disarankan Paid untuk kuota CPU time yang lebih longgar saat proses impor/kalkulasi bulanan).
- Node.js 20+ dan npm.
- `npx wrangler login` sudah dijalankan (atau siapkan `CLOUDFLARE_API_TOKEN` untuk CI).

## 2. Provisioning resource Cloudflare (satu kali)

```bash
cd apps/api

# D1 database — jalankan tiga kali untuk dev/staging/production, sesuaikan nama
npx wrangler d1 create pinus-db
npx wrangler d1 create pinus-db-staging
npx wrangler d1 create pinus-db-production

# R2 bucket untuk berkas impor mentah & arsip ekspor
npx wrangler r2 bucket create pinus-files
npx wrangler r2 bucket create pinus-files-staging
npx wrangler r2 bucket create pinus-files-production
```

Salin setiap `database_id` yang dikembalikan ke `apps/api/wrangler.toml` (mengganti placeholder `REPLACE_WITH_..._D1_DATABASE_ID`).

Buat Pages project untuk frontend:

```bash
cd apps/web
npx wrangler pages project create pinus-web
```

## 3. Secrets (jangan pernah commit ke repo)

Untuk setiap environment (`--env staging`, `--env production`, atau tanpa flag untuk dev):

```bash
cd apps/api
npx wrangler secret put JWT_ACCESS_SECRET       # generate: openssl rand -base64 48
npx wrangler secret put JWT_REFRESH_SECRET      # generate: openssl rand -base64 48 (harus BEDA dari access secret)
```

Untuk local dev, salin `apps/api/.dev.vars.example` ke `apps/api/.dev.vars` dan isi nilai lokal (tidak pernah di-commit).

## 4. Migrasi & seed database

```bash
cd apps/api

# Local (untuk pengembangan)
npm run db:migrate:local
npm run db:generate-seed   # regenerasi seed/seed.sql dari daftar role/permission terbaru
npm run db:seed:local

# Remote (staging/production) — jalankan sekali di awal, lalu setiap ada migration baru
npx wrangler d1 migrations apply pinus-db-production --remote --env production
npx wrangler d1 execute pinus-db-production --remote --env production --file=./seed/seed.sql
```

**Segera setelah seed production dijalankan**, login sebagai Super Admin (kredensial dicetak di `seed/seed.sql` sebagai komentar, atau tentukan sendiri via env var `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` sebelum menjalankan `db:generate-seed`) dan **segera ganti kata sandi** — akun ini dibuat dengan `must_change_password = 1` sehingga sistem akan memaksa penggantian pada login pertama.

Data referensi yang ikut di-seed (unit kerja contoh, job grade, skema proporsi titik-tengah rentang acuan Kepdirjen Yankes, aturan potongan, bobot indeksing) **wajib ditinjau dan disesuaikan** oleh manajemen RSUD Lembang melalui halaman Master Data sebelum periode pertama di-final-kan — lihat catatan `[Medium confidence]` pada PRD bagian 9.1 dan 14.1.

## 5. Konfigurasi domain (penting untuk cookie refresh-token)

Access token dikirim via header `Authorization`, tetapi refresh token disimpan sebagai cookie `httpOnly`. Agar cookie ini bekerja andal di semua browser (termasuk yang memblokir cookie pihak ketiga/cross-site), **sangat disarankan** API dan Pages diletakkan di satu domain yang sama menggunakan path-based routing, bukan dua subdomain `*.workers.dev`/`*.pages.dev` yang terpisah:

```
pinus.rsudlembang.go.id/          -> Cloudflare Pages (pinus-web)
pinus.rsudlembang.go.id/api/*     -> Cloudflare Worker (pinus-api) via Route
```

Langkah di Cloudflare Dashboard: tambahkan custom domain ke Pages project, lalu tambahkan Worker Route `pinus.rsudlembang.go.id/api/*` yang mengarah ke `pinus-api-production`. Update `CORS_ORIGIN` di `wrangler.toml` (`[env.production.vars]`) menjadi origin final tersebut, dan set `VITE_API_BASE_URL=/api` (relatif, karena sudah satu domain) saat build frontend.

Jika terpaksa memakai dua domain berbeda, cookie refresh diset `SameSite=None; Secure` secara otomatis di luar `development` — pastikan HTTPS aktif di kedua sisi (default di Cloudflare).

## 6. CI/CD

Dua workflow GitHub Actions sudah disediakan di `.github/workflows/`:

- **`ci.yml`** — typecheck, unit test mesin kalkulasi, build shared package, bundle-check Worker (`wrangler deploy --dry-run`), dan build Pages. Jalan di setiap push/PR.
- **`deploy.yml`** — jalan di push ke `main`: apply migration D1 production, deploy Worker, build & deploy Pages. Memakai GitHub Environment `production`.

Set secrets berikut di **Settings → Secrets and variables → Actions**:

| Nama | Keterangan |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token dengan scope Workers Scripts:Edit, D1:Edit, R2:Edit, Pages:Edit |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID Cloudflare |

Dan variable (bukan secret) `VITE_API_BASE_URL` bila memakai domain terpisah (isi URL penuh API, mis. `https://pinus-api-production.<subdomain>.workers.dev/api`).

## 7. Deploy manual (tanpa CI)

```bash
# API
cd apps/api
npx wrangler deploy --env production

# Web
cd apps/web
npm run build
npx wrangler pages deploy dist --project-name=pinus-web
```

## 8. Backup & pemulihan bencana

D1 mendukung ekspor snapshot: `npx wrangler d1 export pinus-db-production --remote --output=backup-$(date +%F).sql`. Jadwalkan ini (mis. via GitHub Actions cron atau Cloudflare Cron Trigger terpisah) dan simpan hasilnya di R2/penyimpanan eksternal — data ini menjadi dasar pembayaran hak pegawai sehingga wajib punya cadangan teruji (lihat PRD bagian 6 & 11.3).

## 9. Roadmap yang belum diimplementasikan (lihat PRD bagian 12, Fase 2 & 3)

Fondasi arsitektur sudah mendukung semuanya sebagai perluasan, bukan perombakan:

- Notifikasi email (saat ini in-app saja; tambahkan integrasi email provider di `apps/api/src/lib/notify.ts`).
- Integrasi API langsung ke SIMRS (saat ini impor berkas; modul `apps/api/src/domain/import-validation` sudah terisolasi sehingga sumber data baru tinggal menambah validator baru).
- 2FA untuk peran Direktur/Admin/Keuangan.
- Autentikasi ulang periode-per-periode untuk audit eksternal (Inspektorat/BPK) skala besar.
