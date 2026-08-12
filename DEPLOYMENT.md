# Panduan Deploy PINUS (Railway + Vercel)

Panduan ini menghasilkan **link publik** yang bisa diakses siapa saja: backend (API + database) di Railway, frontend di Vercel. Kedua layanan punya paket gratis yang cukup untuk demo/uji coba.

> Catatan jujur: `apps/api/Dockerfile` dan `vercel.json` di repo ini sudah disiapkan mengikuti pola standar yang teruji untuk pnpm monorepo, tetapi **belum pernah benar-benar dijalankan** di lingkungan pembuatan kode ini karena Docker tidak tersedia di sana. Kemungkinan ada penyesuaian kecil yang diperlukan saat deploy pertama kali — ikuti pesan error di log build Railway/Vercel jika muncul, dan beri tahu saya jika ada yang gagal agar saya bisa perbaiki.

## Bagian 1 — Backend (Railway)

1. Buka [railway.app](https://railway.app), masuk dengan akun GitHub Anda.
2. **New Project → Deploy from GitHub repo** → pilih `rsudlembangkbb/Pinus` → branch `claude/egov-hospital-services-app-6d7wn8` (atau branch hasil merge PR, sesuai kondisi terakhir).
3. Railway akan membuat satu service. Buka **Settings** service tersebut:
   - **Root Directory**: kosongkan/biarkan repo root (jangan diisi `apps/api`).
   - **Dockerfile Path**: `apps/api/Dockerfile`
4. **Add a plugin → PostgreSQL** pada project yang sama. Railway otomatis menyediakan variabel `DATABASE_URL` untuk service lain di project ini — di tab **Variables** service API, tambahkan reference `DATABASE_URL` dari plugin Postgres tersebut (Railway biasanya menawarkan ini otomatis lewat "Add Reference").
5. Di tab **Variables** service API, tambahkan:
   ```
   JWT_ACCESS_SECRET=<string acak minimal 32 karakter>
   JWT_REFRESH_SECRET=<string acak lain, minimal 32 karakter>
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d
   CORS_ORIGIN=https://<akan-diisi-setelah-vercel-deploy>.vercel.app
   STORAGE_DRIVER=local
   STORAGE_LOCAL_PATH=./storage
   SEED_ADMIN_EMAIL=admin@rsudlembang.go.id
   SEED_ADMIN_PASSWORD=<password kuat pilihan Anda>
   NODE_ENV=production
   ```
   (`PORT` otomatis diisi Railway, tidak perlu ditambahkan manual.)
6. **Deploy**. Setelah build sukses, Railway otomatis menjalankan `prisma migrate deploy` lalu menyalakan API (lihat `CMD` di `apps/api/Dockerfile`).
7. Di tab **Settings → Networking**, klik **Generate Domain** untuk mendapat URL publik, misalnya `https://pinus-api-production.up.railway.app`.
8. Uji: buka `https://<domain-railway-anda>/api/v1/health` di browser — harus muncul `{"status":"ok",...}`.
9. Isi data awal (master data contoh + akun login demo) dengan menjalankan seed sekali via Railway CLI:
   ```
   railway login
   railway link   # pilih project ini
   railway run --service <nama-service-api> pnpm --filter @pinus/api prisma:seed
   ```
   Atau jalankan lewat tab **Shell/Console** yang tersedia di dashboard Railway pada service tersebut.

## Bagian 2 — Frontend (Vercel)

1. Buka [vercel.com](https://vercel.com), masuk dengan akun GitHub yang sama.
2. **Add New → Project** → import repo `rsudlembangkbb/Pinus`, branch yang sama.
3. Saat konfigurasi:
   - **Root Directory**: biarkan default (root repo) — jangan diarahkan ke `apps/web`, karena `vercel.json` di root sudah mengatur build command dan output directory-nya.
   - Framework preset otomatis terdeteksi **Next.js** dari `vercel.json`.
4. Tambahkan **Environment Variable**:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://<domain-railway-anda>/api/v1
   ```
   (pakai URL dari Bagian 1 langkah 7, tambahkan `/api/v1` di akhir.)
5. **Deploy**. Setelah selesai Anda dapat URL publik, misalnya `https://pinus-rsudlembang.vercel.app`.
6. **Kembali ke Railway**, update variabel `CORS_ORIGIN` di service API menjadi URL Vercel ini persis (tanpa trailing slash), lalu redeploy service API agar browser diizinkan memanggil API dari domain Vercel.

## Bagian 3 — Uji Coba

Buka URL Vercel Anda, login dengan akun hasil seed (lihat output langkah seed di atas, atau nilai default di `apps/api/prisma/seed.ts`):

| Peran | Email | Password |
|---|---|---|
| Super Admin | `admin@rsudlembang.go.id` | sesuai `SEED_ADMIN_PASSWORD` yang Anda set |
| Admin Jaspel | `adminjaspel@rsudlembang.go.id` | `AdminJaspel123!` |
| Direktur | `direktur@rsudlembang.go.id` | `Direktur123!` |
| Pegawai (contoh) | `andi.wijaya@rsudlembang.go.id` | `Pegawai123!` |

**Segera ganti semua password default ini** setelah login pertama kali (lewat menu Manajemen Pengguna / ubah password), terutama untuk lingkungan yang akan dipakai sungguhan — password seed ini publik karena ada di kode sumber.

## Jika Anda ingin saya yang mengeksekusi deploy-nya

Saya tidak bisa membuat akun Railway/Vercel atas nama Anda, tapi kalau Anda sudah punya akun dan bersedia membagikan **API token** (bukan password akun), saya bisa jalankan proses deploy ini langsung lewat CLI (`railway` dan `vercel`) di sesi ini. Beri tahu saya kalau mau jalur ini.
