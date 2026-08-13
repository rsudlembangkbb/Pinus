# PINUS

Sistem Pembagian Insentif dan Jasa Pelayanan Untuk Semua untuk RSUD Lembang, dibangun berdasarkan PRD `PRD_Aplikasi_PINUS_RSUD_Lembang.pdf`.

## Stack

- `apps/web`: Next.js 16, TypeScript, Tailwind CSS
- `apps/api`: NestJS 11, Prisma, PostgreSQL, PDFKit, ExcelJS
- Database: PostgreSQL
- Orkestrasi lokal: Docker Compose

## Fitur MVP yang sudah dibangun

- Autentikasi login berbasis JWT + cookie httpOnly
- RBAC untuk `SUPER_ADMIN`, `ADMIN_JASPEL`, `VERIFIER_UNIT`, `FINANCE`, `DIRECTOR`, `EMPLOYEE`, `AUDITOR`
- Master data unit kerja, job grade, pegawai
- Periode kalkulasi bulanan
- Impor transaksi SIMRS `.csv`/`.xlsx`
- Mesin kalkulasi dasar untuk tenaga medis, tenaga kesehatan, dan administrasi
- Workflow approval berjenjang unit, keuangan, direktur
- Dashboard operasional dan dashboard self-service pegawai
- Slip Jaspel PDF dan ekspor rekap Excel
- Audit trail aktivitas penting
- Seed data dan akun demo tanpa mock

## Menjalankan Dengan Docker

```bash
docker compose up --build
```

Service yang tersedia:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Swagger: `http://localhost:3001/docs`

## Menjalankan Manual

1. Siapkan PostgreSQL lokal.
2. Salin env API:

```bash
cp apps/api/.env.example apps/api/.env
```

3. Install dependency workspace:

```bash
pnpm install
```

4. Generate Prisma client, sinkronkan schema, lalu seed:

```bash
pnpm --dir apps/api prisma generate
pnpm --dir apps/api prisma db push
pnpm --dir apps/api prisma:seed
```

5. Jalankan API dan Web:

```bash
pnpm --dir apps/api start:dev
pnpm --dir apps/web dev
```

## Akun Demo

Password semua akun: `pinus123`

- `adminjaspel`
- `verifikator`
- `keuangan`
- `direktur`
- `pegawai`
- `auditor`
- `superadmin`

## Catatan Implementasi

- Nilai proporsi, bobot, minimum guarantee, dan aturan potongan diperlakukan sebagai parameter konfigurabel sesuai PRD.
- Impor fase awal mengikuti berkas template, belum integrasi API langsung ke SIMRS.
- Mesin kalkulasi sudah berjalan end-to-end, namun formula final RSUD tetap perlu penyesuaian angka resmi dari Keputusan Bupati/Direktur sebelum go-live produksi.
