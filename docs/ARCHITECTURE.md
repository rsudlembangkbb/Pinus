# Arsitektur PINUS

Ringkasan keputusan desain teknis. Untuk kebutuhan produk lihat PRD (`PRD_Aplikasi_PINUS_RSUD_Lembang.pdf`); dokumen ini menjelaskan **bagaimana** PRD tersebut diimplementasikan di atas ekosistem Cloudflare, bukan Next.js/NestJS/PostgreSQL seperti rekomendasi awal PRD bagian 11.2 — stack diadaptasi ke Cloudflare Pages + Workers + D1 sesuai kebutuhan proyek ini.

## Peta komponen

```
packages/shared/     Tipe TS, enum, skema validasi zod, dan util uang (fixed-point)
                      dipakai bersama oleh api & web — satu sumber kebenaran untuk bentuk data.

apps/api/             Hono di atas Cloudflare Workers.
  src/domain/         Modul murni tanpa dependency framework/DB:
    calculation-engine/  Mesin kalkulasi Jaspel (medis/tim-unit/indeksing + potongan +
                          minimum requirement + penyesuaian pagu). Diuji unit test
                          terpisah dari HTTP/DB (lihat test/calculation-engine.test.ts).
    import-validation/   Validator baris impor SIMRS/kehadiran/skor kinerja.
  src/modules/        Satu folder per domain REST (master-data, import, calculation,
                      workflow, transparency, reports, users, audit, dashboard, notifications).
  src/middleware/     requireAuth (verifikasi JWT + load user dari D1), requirePermission
                      (RBAC granular), assertWorkUnitAccess (scoping Verifikator Unit).
  src/lib/            password (PBKDF2 via WebCrypto), jwt (jose), audit (recordAudit),
                      pdf (pdf-lib), excel (SheetJS), zip (writer ZIP store-only tanpa
                      dependency tambahan), notify.
  migrations/          SQL mentah, diterapkan via `wrangler d1 migrations apply` (bukan
                      drizzle-kit generate) — drizzle-orm dipakai murni sebagai query
                      builder tipe-aman di atas skema yang sama.

apps/web/             React + Vite SPA di Cloudflare Pages (bukan Next.js) — pilihan ini
                      karena tidak ada kebutuhan SSR (semua data personal/rahasia,
                      tidak ada halaman publik yang perlu di-index mesin pencari) dan
                      SPA murni jauh lebih sederhana untuk dijalankan di atas Pages
                      dibanding @cloudflare/next-on-pages.
```

## Mengapa keputusan-keputusan ini

**Uang sebagai integer Rupiah, persentase sebagai basis point.** SQLite (dasar D1) tidak
punya tipe `DECIMAL`. Alih-alih menyimpan uang sebagai `REAL` (floating point, berisiko
salah pembulatan pada rekonsiliasi total — dilarang eksplisit oleh PRD bagian 6), setiap
nilai uang disimpan sebagai `INTEGER` Rupiah utuh, dan setiap persentase/bobot sebagai
`INTEGER` basis point (1 bp = 0.01%). Perhitungan bertingkat (mis. potongan di atas hasil
proporsional di atas hasil indeksing) dilakukan di `packages/shared/src/money.ts` memakai
aritmetika `bigint` berskala 10⁶ sehingga tidak pernah menyentuh IEEE-754 sampai
pembulatan akhir ke Rupiah.

**Mesin kalkulasi adalah modul domain murni.** `apps/api/src/domain/calculation-engine/`
tidak mengimpor Hono, Drizzle, atau `Env` apa pun — hanya menerima array data biasa dan
mengembalikan array hasil biasa. Ini persis permintaan PRD bagian 11.3 ("pure functions ...
tanpa bergantung pada database/HTTP") dan yang membuat 19 unit test di
`test/calculation-engine.test.ts` bisa memverifikasi kasus dari PRD (rentang proporsi
tabel 9.1, potongan Pasal 15, minimum requirement, penyesuaian pagu) tanpa perlu database
sungguhan. `apps/api/src/modules/calculation/dataGathering.ts` adalah satu-satunya
jembatan D1 → tipe input mesin.

**Skema proporsi & aturan potongan bertipe versioned.** Setiap tabel master yang nilainya
bisa berubah karena regulasi (`proportion_schemes`, `deduction_rules`, `indexing_weights`,
`minimum_requirements`) punya `effective_from`/`effective_to`, tidak pernah di-`UPDATE`
langsung — endpoint POST-nya otomatis menutup versi lama (`effective_to = effective_from`
versi baru) lalu menyisipkan baris baru. Mesin kalkulasi memfilter "apa yang berlaku pada
tanggal referensi periode" sehingga periode yang sudah final tidak pernah berubah hasilnya
walau kebijakan berubah di kemudian hari (PRD bagian 7, catatan).

**Audit trail lewat pemanggilan eksplisit, bukan hook ORM otomatis.** `recordAudit()`
dipanggil langsung oleh setiap handler yang mengubah state (create/update/approve/reject/
lock/import commit/calculate/login). Ini disengaja: snapshot before/after yang tersimpan
adalah bentuk domain yang bermakna (mis. `{status: 'DRAFT'}` → `{status: 'FINAL'}`), bukan
diff SQL mentah yang sulit dibaca auditor. Tabel `audit_logs` tidak punya endpoint
UPDATE/DELETE sama sekali di seluruh API — itulah yang menjaga sifat immutable-nya, bukan
trigger database.

**RBAC granular disimpan di D1, bukan hanya di kode.** `role_permissions` adalah tabel,
diisi dari `packages/shared/src/permissions.ts` saat seed. Token akses (JWT) hanya berisi
`sub` (user id) dan `role` — daftar permission dan status `isActive` selalu dibaca ulang
dari D1 di setiap request lewat `requireAuth`. Konsekuensinya: menonaktifkan akun atau
mengubah permission suatu peran berlaku seketika tanpa menunggu token lama kedaluwarsa,
dengan biaya satu query tambahan per request (murah di D1 untuk skala satu rumah sakit).

**Refresh token beredar sebagai cookie httpOnly + rotasi.** Access token (umur 15 menit)
dikirim lewat header `Authorization` dan disimpan di memori JS saja (bukan
localStorage) untuk mengurangi permukaan serangan XSS. Refresh token (umur 7 hari) adalah
cookie `httpOnly`, hanya terpasang di path `/api/auth`, dan dirotasi setiap dipakai —
token lama langsung direvoke begitu token baru diterbitkan (`apps/api/src/modules/auth/routes.ts`).
Karena rotasi ini, dua request refresh yang race pada cookie yang sama akan membuat satu
di antaranya gagal 401 secara sah; sisi frontend (`apps/web/src/lib/api-client.ts`)
mem-dedup semua pemanggil (React StrictMode's double-effect di dev, atau permintaan API
paralel yang sama-sama kena 401) lewat satu `refreshSession()` singleton promise.

**PDF & ZIP tanpa headless browser.** Cloudflare Workers tidak menjalankan Chrome, jadi
slip Jaspel dibuat dengan `pdf-lib` (murni JS, drawing primitif manual) alih-alih
Puppeteer seperti rekomendasi awal PRD. Ekspor massal (`slips.zip`) memakai penulis ZIP
"store-only" buatan sendiri (`apps/api/src/lib/zip.ts`, ~100 baris, CRC32 + local/central
directory) karena PDF sudah terkompresi secara internal sehingga DEFLATE tidak perlu —
ini menghindari dependency kompresi tambahan yang berat untuk edge runtime.

**Impor SIMRS dua tahap: staging lalu commit.** Setiap unggahan disimpan mentah di R2
(`imports/{periodId}/{batchId}/{fileName}`), lalu setiap barisnya divalidasi dan disimpan
ke `import_rows` dengan status OK/WARNING/ERROR (PRD bagian 8.1). Baris yang gagal tidak
menggagalkan seluruh unggahan. Commit adalah langkah terpisah yang **memvalidasi ulang**
terhadap master data *saat commit* (bukan memakai snapshot saat upload) — supaya
perubahan master data di antara upload dan commit tidak membuat data usang lolos.

## Yang sengaja belum dibangun (lihat `docs/DEPLOYMENT.md` §9)

Notifikasi email, integrasi API langsung ke SIMRS, dan 2FA adalah Fase 2/3 pada roadmap
PRD (bagian 12) — arsitektur di atas sudah menyediakan titik ekstensi untuk masing-masing
tanpa perombakan (lihat referensi modul di `DEPLOYMENT.md`).
