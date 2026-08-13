# PINUS

**Sistem Pembagian Insentif daN Jasa Pelayanan Untuk Semua** — RSUD Lembang, Kabupaten Bandung Barat.

PINUS digitalisasi siklus bulanan perhitungan dan pembagian Jasa Pelayanan (Jaspel)/insentif kinerja RSUD Lembang: impor data dari empat sumber terpisah (SIMRS, klaim BPJS, BARAYA, indeks kinerja), mesin kalkulasi proporsional, alur verifikasi berjenjang (maker–checker–approver), hingga dashboard transparansi mandiri untuk setiap pegawai. Dibangun berdasarkan `PRD_Aplikasi_PINUS_RSUD_Lembang.pdf`.

## Arsitektur

Seluruhnya berjalan di ekosistem serverless Cloudflare:

| Layer | Teknologi |
|---|---|
| Frontend + API | Next.js 15 (App Router) di atas **Cloudflare Workers**, dibundel dengan `@opennextjs/cloudflare` |
| Basis data | **Cloudflare D1** (SQLite), diakses via Drizzle ORM. Seluruh nilai uang disimpan sebagai `INTEGER` rupiah (bukan `REAL`) |
| Penyimpanan berkas | **Cloudflare R2** (berkas impor mentah) |
| Sesi | JWT (HS256, `jose`) di cookie `httpOnly`; hash kata sandi PBKDF2-SHA256 via WebCrypto (bcrypt/argon2 tidak tersedia di runtime Workers) |
| Antrean (disiapkan, opsional) | Cloudflare Queues (`pinus-import-queue`) untuk pemrosesan impor besar secara asinkron di fase berikutnya |
| PDF | `pdf-lib` (generator terprogram, bukan headless browser) |
| Excel | `xlsx` (SheetJS) |

Logika domain (mesin kalkulasi Jaspel) berada di `src/domain/calculation/*` sebagai *pure functions* tanpa dependensi ke Next.js/D1/Workers — lihat `tests/calculation/*.test.ts` (32 skenario, termasuk aritmetika integer-rupiah presisi penuh untuk penyesuaian pagu pada nilai besar).

## Struktur Proyek

```
src/
  app/
    (app)/              # halaman terautentikasi (layout + nav berbasis peran)
    api/                # route handlers (REST JSON)
    login/
  domain/
    calculation/         # mesin kalkulasi murni (medis, tim unit, indeksing, potongan, pagu, kebijakan BPJS)
    import/               # template kolom + validator per sumber impor
    export/               # generator slip PDF
  db/                     # skema Drizzle + accessor D1
  lib/                    # auth, RBAC, audit trail, xlsx, money helpers, dst.
drizzle/migrations/        # migrasi SQL (dijalankan via wrangler d1 migrations)
scripts/generate-seed.mjs  # generator data referensi + akun Super Admin bootstrap
tests/calculation/          # unit test mesin kalkulasi
```

## Menjalankan Secara Lokal

Prasyarat: Node.js 20+, akun Cloudflare (gratis untuk development), `npx wrangler login`.

```bash
npm install

# 1) Buat resource Cloudflare (sekali saja)
npx wrangler d1 create pinus-db            # salin database_id ke wrangler.toml
npx wrangler r2 bucket create pinus-files
npx wrangler kv namespace create pinus-sessions   # salin id ke wrangler.toml
npx wrangler queues create pinus-import-queue

# 2) Terapkan skema database (lokal, untuk `wrangler dev`)
npm run db:migrate:local

# 3) Buat data referensi + akun Super Admin bootstrap
node scripts/generate-seed.mjs   # catat username/password yang ditampilkan - hanya muncul sekali
npm run db:seed:local

# 4) Konfigurasi secret lokal
cp .dev.vars.example .dev.vars
# isi JWT_SECRET dengan nilai acak: openssl rand -base64 48

# 5) Jalankan
npm run dev
```

Buka `http://localhost:3000/login` dan masuk dengan akun Super Admin dari langkah 3, lalu segera ganti kata sandi melalui menu **Ganti Kata Sandi**.

## Alur Kerja Aplikasi

1. **Master Data** (`/master/*`, peran Super Admin) — unit kerja, pegawai, job grade, skema proporsi (bertipe versioned/time-bound), aturan potongan, pendapatan minimum, bobot indeksing, pemetaan identitas lintas sistem.
2. **Buka Periode** (`/periods`, peran Admin Jaspel) — tetapkan kebijakan klaim BPJS pending (akrual/kas/hibrida — lihat PRD §9.6, **wajib diputuskan manajemen RSUD Lembang**), pagu insentif, alokasi administrasi.
3. **Impor Data** (tab *Impor Data* pada halaman periode) — unggah template per sumber (SIMRS, klaim BPJS, BARAYA absensi, BARAYA biodata, indeks kinerja). Baris gagal validasi ditandai tanpa menggagalkan keseluruhan proses; dapat diunggah ulang sebagian.
4. **Kalkulasi** (tab *Kalkulasi*) — jalankan simulasi (what-if, tidak memengaruhi data resmi) atau kalkulasi resmi. Setiap proses kalkulasi tersimpan sebagai `calculation_runs` + snapshot parameter untuk audit.
5. **Verifikasi Berjenjang** (tab *Verifikasi*) — Verifikator Unit → Bagian Keuangan → Direktur. Penolakan mengembalikan periode ke status "sudah dikalkulasi" untuk perbaikan data.
6. **Publikasi** — persetujuan Direktur otomatis mengunci (`locked`) dan mempublikasikan hasil; pegawai dapat mengakses dashboard transparansi pribadinya (`/dashboard`).
7. **Ekspor & Pelaporan** (`/reports`) — rekap per unit, rekap total, data mentah, slip massal (ZIP), laporan rekonsiliasi klaim BPJS pending.
8. **Koreksi Pasca-Finalisasi** — `POST /api/corrections` (diajukan Admin Jaspel) dan `POST /api/corrections/:id/approve` (otorisasi Direktur) mencatat penyesuaian atas periode yang sudah terkunci, tanpa mengubah data historis langsung.

## Keamanan

- RBAC granular (7 peran sesuai PRD §3), dengan pemeriksaan kepemilikan data (mis. pegawai hanya dapat melihat datanya sendiri, Verifikator Unit dibatasi ke unit kerjanya).
- `token_version` per pengguna memungkinkan pencabutan sesi seketika saat peran/status akun berubah, tanpa menunggu kedaluwarsa JWT.
- Audit trail immutable (`audit_logs`) pada setiap perubahan master data, parameter, proses impor/kalkulasi, dan keputusan approval/reject.
- Kata sandi di-hash dengan PBKDF2-HMAC-SHA256 (210,000 iterasi) via WebCrypto.

**Risiko yang diketahui secara sadar diterima untuk MVP** (didokumentasikan, bukan diabaikan):
- Paket `xlsx` (SheetJS) versi npm memiliki advisory ReDoS/prototype-pollution pada parsing berkas yang tidak dipercaya. Mitigasi: endpoint impor hanya dapat diakses staf terautentikasi berperan Admin Jaspel/Super Admin (bukan publik), dengan batas ukuran berkas 15MB. Untuk hardening lebih lanjut, evaluasi migrasi ke build resmi SheetJS dari `cdn.sheetjs.com` atau `exceljs` (perlu verifikasi kompatibilitas runtime Workers).
- Proses impor & kalkulasi saat ini berjalan sinkron dalam satu request Worker (bukan melalui Cloudflare Queues) — memadai untuk volume RSUD Lembang saat ini, namun perlu dipecah menjadi job asinkron (binding `IMPORT_QUEUE` sudah disiapkan di `wrangler.toml`) bila volume transaksi bertambah signifikan (lihat PRD §11.4).
- 2FA untuk peran berwewenang tinggi (Direktur/Keuangan/Admin) belum diimplementasikan — direkomendasikan sebagai peningkatan Fase 2.

## Testing

```bash
npm run typecheck   # TypeScript end-to-end
npm run lint         # ESLint
npm run test          # Unit test mesin kalkulasi (32 skenario)
npm run build          # Next.js production build
npm run cf:build         # Bundle Workers via OpenNext (validasi kompatibilitas runtime)
```

## Deployment ke Production

1. Buat resource Cloudflare production (`wrangler d1 create`, `r2 bucket create`, `kv namespace create`, `queues create`) dan isi ID-nya ke `wrangler.toml`.
2. Terapkan migrasi: `npm run db:migrate:remote`.
3. Set secret: `npx wrangler secret put JWT_SECRET`.
4. Deploy: `npm run deploy` (build OpenNext + `wrangler deploy`).
5. Atau gunakan `.github/workflows/deploy.yml` (perlu `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID` sebagai GitHub Secrets pada environment `production`).

## Sebelum Go-Live (Wajib Dikonfirmasi Manajemen RSUD Lembang)

Sesuai catatan PRD, hal-hal berikut **bukan keputusan teknis** dan wajib ditetapkan resmi sebelum sistem digunakan untuk produksi:

1. Nilai final persentase proporsi Jaspel per unit/peran (Keputusan Bupati/Direktur) — nilai di `scripts/generate-seed.mjs` hanya titik tengah rentang acuan nasional Kepdirjen Yankes, **bukan angka resmi RSUD Lembang**.
2. Kebijakan basis perhitungan klaim BPJS pending: akrual vs kas vs hibrida (PRD §9.6).
3. Struktur organisasi alur persetujuan (apakah Tim Remunerasi = tim lintas unit sesuai Perbup, atau unit internal RSUD).
4. Struktur ekspor data aktual dari SIMRS RSUD Lembang (kolom, format) untuk disesuaikan dengan template impor bila berbeda.

## Lisensi Data

Aplikasi ini menangani data finansial dan kepegawaian yang bersifat rahasia. Jangan mengunggah data pasien/pegawai riil ke lingkungan pengembangan/staging bersama yang tidak diamankan setara dengan lingkungan produksi.
