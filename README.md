# PINUS

**Sistem Pembagian Insentif daN Jasa Pelayanan Untuk Semua** — RSUD Lembang, Kabupaten Bandung Barat.

PINUS mendigitalisasi siklus bulanan perhitungan dan pembagian jasa pelayanan (Jaspel) serta insentif kinerja RSUD Lembang: impor data SIMRS, mesin kalkulasi proporsional, alur verifikasi berjenjang (maker–checker–approver), dan dashboard transparansi mandiri untuk setiap pegawai. Dibangun berdasarkan PRD internal (Agustus 2026).

## Arsitektur

Monorepo pnpm workspace:

```
apps/api      NestJS + Prisma + PostgreSQL — REST API, mesin kalkulasi, workflow, laporan
apps/web      Next.js (App Router) + Tailwind — dashboard per peran
packages/shared  Enum & matriks RBAC yang dipakai bersama API dan web
```

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 15 (React 19), TypeScript, Tailwind CSS, TanStack Query |
| Backend/API | NestJS 10, class-validator, Swagger (`/api/docs`) |
| Basis Data | PostgreSQL via Prisma ORM, tipe `Decimal` untuk semua nilai finansial |
| Auth | JWT (access + refresh token rotation), RBAC berbasis matriks izin di `packages/shared` |
| Kalkulasi | Modul domain murni (`apps/api/src/calculation/domain`) — `decimal.js`, tanpa dependensi framework/DB, 26 unit test |
| Dokumen | `pdfkit` (slip Jaspel), `exceljs` (rekap Excel), `archiver` (ZIP slip massal) |
| Antrean (disiapkan) | Redis — variabel env sudah ada; pemrosesan impor saat ini sinkron untuk kesederhanaan Fase 1, gampang dipindah ke BullMQ untuk volume sangat besar |

## Menjalankan secara lokal

### Prasyarat

- Node.js ≥ 20, pnpm ≥ 10
- PostgreSQL 16 berjalan secara lokal
- Redis berjalan secara lokal (disiapkan untuk kebutuhan job queue mendatang)

### 1. Instal dependensi

```bash
pnpm install
```

### 2. Siapkan basis data

```bash
createuser pinus --pwprompt   # atau gunakan role Postgres yang sudah ada
createdb -O pinus pinus_dev
```

### 3. Konfigurasi environment

```bash
cp apps/api/.env.example apps/api/.env
# Sesuaikan DATABASE_URL, REDIS_URL, dan ganti JWT_ACCESS_SECRET/JWT_REFRESH_SECRET
cp apps/web/.env.example apps/web/.env.local
```

### 4. Migrasi & seed data demo

```bash
cd apps/api
npx prisma migrate deploy
npx prisma db seed
```

Seed menghasilkan master data contoh (unit kerja, skema proporsi, job grade, aturan potongan, minimum requirement) serta akun login untuk setiap peran — lihat output terminal setelah seed selesai.

### 5. Jalankan aplikasi

```bash
# Terminal 1 — API (http://localhost:4000/api/v1, dokumentasi di /api/docs)
pnpm --filter @pinus/api build && node apps/api/dist/main.js
# atau mode watch:
pnpm dev:api

# Terminal 2 — Web (http://localhost:3000)
pnpm dev:web
```

## Alur kerja bulanan (ringkas)

1. **Buka Periode** — Admin Jaspel membuka periode baru (mis. "Agustus 2026").
2. **Impor Data SIMRS** — unggah `.xlsx`/`.csv` sesuai template bawaan; sistem memvalidasi tiap baris terhadap master data dan menandai baris bermasalah tanpa menggagalkan seluruh proses.
3. **Kalkulasi** — mesin kalkulasi proporsional (tenaga medis, tim unit tenaga kesehatan, indeksing administrasi/struktural), menerapkan potongan, minimum requirement, dan penyesuaian proporsional atas pagu bila terlampaui.
4. **Verifikasi Berjenjang** — Verifikator Unit → Bagian Keuangan → Direktur, masing-masing dengan pencatatan waktu, aktor, dan catatan; penolakan mengembalikan periode ke status diproses.
5. **Finalisasi & Publikasi** — setelah disetujui penuh, periode terkunci (immutable) dan dipublikasikan; setiap pegawai dapat melihat rincian Jaspel miliknya sendiri dan mengunduh slip PDF.
6. **Ekspor** — rekap per unit (Excel), slip massal (ZIP), dan data mentah untuk audit.

Seluruh perubahan master data, parameter, hasil impor, proses kalkulasi, dan keputusan approval tercatat pada audit log (`/dashboard/audit`).

## Pengujian

```bash
pnpm --filter @pinus/api test
```

26 unit test menguji mesin kalkulasi murni: proporsi tenaga medis (termasuk kasus pindah unit di tengah periode), distribusi tim unit (dengan/tanpa subsidi lintas-unit), indeksing administrasi, seleksi aturan potongan saat beberapa kondisi terpenuhi sekaligus, penerapan minimum requirement, dan penyesuaian proporsional atas pagu.

## Catatan implementasi & keterbatasan Fase 1

Sesuai roadmap PRD, rilis ini mencakup lingkup **Fase 1 (MVP)**: master data, impor berbasis berkas, mesin kalkulasi inti, alur verifikasi dasar, dashboard transparansi, ekspor Excel/PDF, RBAC, dan audit trail. Beberapa hal yang secara eksplisit menjadi catatan/asumsi terbuka dari PRD dan perlu dikonfirmasi manajemen RSUD Lembang sebelum go-live produksi:

- **Nilai persentase proporsi, bobot indeksing, dan minimum requirement pada seed data adalah contoh** (mengikuti rentang acuan nasional Kepdirjen Yankes 2025), bukan angka final RSUD Lembang — wajib dikonfigurasi ulang melalui menu Master Data sebelum digunakan untuk perhitungan riil.
- **Pola subsidi lintas-unit** untuk distribusi tim tenaga kesehatan (contoh 20% tetap/80% subsidi pada dokumen acuan Kemenkes) diimplementasikan sebagai parameter opsional per periode (`unitTeamFixedPortionPercent`), default 100% (tanpa subsidi) — perlu dikonfirmasi apakah RSUD Lembang mengadopsi pola ini.
- **Aturan potongan tidak diakumulasikan**: jika beberapa kondisi potongan terpenuhi sekaligus pada satu pegawai, sistem menerapkan hanya persentase tertinggi, bukan menjumlahkan — asumsi ini didokumentasikan di kode (`apps/api/src/calculation/domain/deductions.ts`) dan perlu konfirmasi kebijakan.
- **Penyesuaian pagu** diterapkan seragam ke seluruh penerima termasuk yang sudah mencapai batas minimum requirement (sesuai teks regulasi "seluruh penerima"), yang berpotensi membuat nominal turun di bawah minimum requirement dalam kasus tepi — tercatat sebagai pertanyaan terbuka di PRD §9.4.
- **Integrasi API langsung ke SIMRS** belum ada (Fase 1 memakai impor berkas sesuai lingkup PRD); job queue (BullMQ/Redis) untuk pemrosesan impor volume sangat besar sudah disiapkan variabel environment-nya namun belum diaktifkan karena volume data uji masih dalam batas wajar untuk pemrosesan sinkron.
- **Penyimpanan berkas** memakai disk lokal (`STORAGE_LOCAL_PATH`) untuk pengembangan; gunakan object storage S3-compatible (mis. Supabase Storage) di produksi dengan mengganti `StorageService`.
