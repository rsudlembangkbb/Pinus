# PINUS

**P**embagian **I**nsentif da**N** Jasa Pelayanan **U**ntuk **S**emua — sistem digital untuk
mengelola siklus bulanan perhitungan dan pembagian Jaspel (jasa pelayanan) serta insentif
kinerja RSUD Lembang, Kabupaten Bandung Barat: impor data SIMRS, mesin kalkulasi
proporsional, verifikasi berjenjang, hingga transparansi rincian penerimaan per pegawai.

Dibangun di atas ekosistem serverless Cloudflare: **Workers (Hono)** untuk API, **D1**
untuk basis data, **R2** untuk penyimpanan berkas, dan **Pages (React)** untuk frontend.
Lihat `docs/ARCHITECTURE.md` untuk rasional desain dan `docs/DEPLOYMENT.md` untuk panduan
penyiapan production.

## Struktur repositori

```
apps/api/       Backend — Hono di Cloudflare Workers, D1, R2, mesin kalkulasi Jaspel
apps/web/       Frontend — React + Vite SPA di Cloudflare Pages
packages/shared/ Tipe TypeScript, skema validasi, dan util uang bersama api & web
docs/           Arsitektur & panduan deployment
```

## Mulai pengembangan lokal

```bash
npm install

# Siapkan database D1 lokal
cd apps/api
npm run db:migrate:local
npm run db:generate-seed && npm run db:seed:local
cp .dev.vars.example .dev.vars   # isi JWT_ACCESS_SECRET / JWT_REFRESH_SECRET

# Terminal 1 — API (http://localhost:8787)
npm run dev

# Terminal 2 — Frontend (http://localhost:5173, proxy /api ke port 8787)
cd ../web
npm run dev
```

Login dengan akun Super Admin yang dicetak sebagai komentar di `apps/api/seed/seed.sql`
(default: `admin@rsudlembang.go.id`) — sistem akan meminta penggantian kata sandi pada
login pertama.

## Perintah penting

| Perintah (dari root) | Keterangan |
|---|---|
| `npm run typecheck` | Type-check shared + api + web |
| `npm run test` | Unit test mesin kalkulasi Jaspel |
| `npm run build` | Build semua paket |
| `npm run db:migrate:local` / `:remote` | Terapkan migrasi D1 |
| `npm run db:seed:local` | Isi data awal (role, permission, master data contoh) |

## Status implementasi

Modul Fase 1 (MVP) pada PRD sudah terimplementasi end-to-end tanpa mock: master data,
impor SIMRS (xlsx/csv), mesin kalkulasi (medis/tenaga kesehatan/administrasi), alur
verifikasi berjenjang, dashboard transparansi pegawai + slip PDF, dashboard manajemen,
ekspor Excel/ZIP, RBAC, dan audit trail. Item Fase 2/3 (notifikasi email, integrasi API
SIMRS langsung, 2FA) didokumentasikan sebagai perluasan di `docs/DEPLOYMENT.md`.
