# Panduan Deploy PINUS — Gratis (Vercel + Render + Supabase)

Kombinasi ini menghasilkan **link publik** yang bisa diakses siapa saja, dengan tiga layanan yang punya paket gratis berkelanjutan (bukan cuma trial):

| Bagian | Layanan | Catatan paket gratis |
|---|---|---|
| Frontend (Next.js) | **Vercel** | Gratis, tanpa batas waktu, cocok untuk Next.js |
| Backend (NestJS API) | **Render** | Gratis, tapi "tidur" setelah 15 menit tanpa aktivitas — permintaan pertama setelah itu butuh ~30-60 detik untuk bangun lagi |
| Database (PostgreSQL) | **Supabase** | Gratis, 500 MB — project di-pause otomatis kalau 7 hari tidak ada aktivitas database sama sekali (tinggal buka dashboard Supabase untuk membangunkannya lagi) |

> Catatan jujur: konfigurasi (`render.yaml`, `vercel.json`) di repo ini sudah disiapkan mengikuti pola standar yang teruji untuk pnpm monorepo, tapi proses deploy sesungguhnya di dashboard Render/Vercel **belum saya jalankan langsung** (butuh akun Anda). Kalau ada error saat build pertama kali, salin pesan errornya ke saya dan saya bantu perbaiki.

## Bagian 1 — Database (Supabase)

1. Buka [supabase.com](https://supabase.com) → **New Project**. Pilih region terdekat (Singapore).
2. Simpan **Database Password** yang Anda buat saat itu — akan dipakai di connection string.
3. Setelah project aktif, buka **Project Settings → Database**. Anda akan melihat dua jenis connection string:
   - **Connection pooling** (port `6543`, mode *Transaction*) → ini untuk `DATABASE_URL`. Tambahkan `?pgbouncer=true` di akhir.
   - **Direct connection** (port `5432`) → ini untuk `DIRECT_URL`.

   Contoh:
   ```
   DATABASE_URL="postgresql://postgres.xxxxx:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.xxxxx:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
   ```
4. Simpan kedua string ini — dipakai di Bagian 2.

## Bagian 2 — Backend (Render)

1. Buka [render.com](https://render.com), masuk dengan akun GitHub Anda.
2. **New + → Blueprint** → pilih repo `rsudlembangkbb/Pinus`, branch `claude/egov-hospital-services-app-6d7wn8` (atau branch hasil merge PR). Render akan otomatis membaca `render.yaml` di root repo dan menawarkan membuat service `pinus-api`.
3. Sebelum **Apply**, isi environment variable yang ditandai perlu diisi manual:
   ```
   DATABASE_URL      = (connection pooling string dari Supabase, Bagian 1)
   DIRECT_URL        = (direct connection string dari Supabase, Bagian 1)
   CORS_ORIGIN       = https://<akan-diisi-setelah-vercel-deploy>.vercel.app
   SEED_ADMIN_PASSWORD = (password kuat pilihan Anda)
   ```
   (`JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` sudah otomatis di-generate acak oleh Render — tidak perlu diisi.)
4. **Apply/Deploy**. Proses build ±3-5 menit (install dependencies, build, lalu `prisma migrate deploy` otomatis membuat seluruh tabel di Supabase saat start).
5. Setelah status **Live**, salin URL publiknya, misalnya `https://pinus-api.onrender.com`.
6. Uji: buka `https://pinus-api.onrender.com/api/v1/health` — harus muncul `{"status":"ok",...}`. (Kalau ini permintaan pertama setelah lama tidak dipakai, tunggu ~30-60 detik.)
7. Isi data awal (master data contoh + akun demo per peran) — buka tab **Shell** pada service ini di dashboard Render, lalu jalankan:
   ```
   pnpm --filter @pinus/api exec prisma db seed
   ```

## Bagian 3 — Frontend (Vercel)

1. Buka [vercel.com](https://vercel.com), masuk dengan akun GitHub yang sama.
2. **Add New → Project** → import repo `rsudlembangkbb/Pinus`, branch yang sama.
3. Biarkan **Root Directory** default (root repo) — `vercel.json` di root sudah mengatur cara build & lokasi outputnya, framework Next.js otomatis terdeteksi.
4. Tambahkan **Environment Variable**:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://pinus-api.onrender.com/api/v1
   ```
   (ganti dengan URL Render Anda dari Bagian 2, tambahkan `/api/v1` di akhir.)
5. **Deploy**. Setelah selesai Anda dapat URL publik, misalnya `https://pinus-rsudlembang.vercel.app`.
6. **Kembali ke Render**, ubah env var `CORS_ORIGIN` service API menjadi URL Vercel ini persis (tanpa trailing slash) → simpan → service otomatis redeploy.

## Bagian 4 — Uji Coba

Buka URL Vercel Anda, login dengan akun hasil seed:

| Peran | Email | Password |
|---|---|---|
| Super Admin | `admin@rsudlembang.go.id` | sesuai `SEED_ADMIN_PASSWORD` yang Anda set |
| Admin Jaspel | `adminjaspel@rsudlembang.go.id` | `AdminJaspel123!` |
| Direktur | `direktur@rsudlembang.go.id` | `Direktur123!` |
| Pegawai (contoh) | `andi.wijaya@rsudlembang.go.id` | `Pegawai123!` |

**Segera ganti semua password default ini** setelah login pertama, terutama untuk lingkungan yang akan dipakai sungguhan — password seed ini publik karena ada di kode sumber.

## Batasan yang perlu diketahui di paket gratis ini

- **Render "tidur"**: kalau API tidak diakses 15 menit, permintaan berikutnya lambat (~30-60 detik) sampai server bangun lagi. Untuk pemakaian rutin sehari-hari efeknya minim; untuk demo ke pimpinan, buka dulu link API-nya 1 menit sebelum presentasi agar sudah "bangun".
- **Berkas impor mentah tidak permanen**: arsip berkas SIMRS yang diunggah disimpan di disk Render yang sifatnya sementara (hilang saat redeploy/restart). Data hasil impor (baris transaksi, dsb.) **aman** karena sudah tersimpan di database Supabase — yang hilang hanya salinan file mentahnya.
- **Supabase pause**: kalau tidak ada aktivitas ke database sama sekali selama 7 hari, project otomatis nonaktif sementara — tinggal buka dashboard Supabase untuk mengaktifkan lagi (data tidak hilang).

Ketiga batasan ini wajar untuk tahap uji coba/demo. Kalau nanti PINUS akan dipakai operasional sungguhan oleh RSUD Lembang, sebaiknya naik ke paket berbayar (Render Starter ~$7/bulan, Supabase Pro $25/bulan) agar tidak ada jeda "bangun tidur" dan datanya tidak berisiko pause.

## Catatan: kenapa ini harus Anda jalankan sendiri

Sesi kerja Claude Code ini berjalan di sandbox dengan akses jaringan terbatas (kebijakan organisasi) — hanya boleh mengakses beberapa host tertentu lewat proxy HTTPS. `api.render.com`, `api.vercel.com`, dan `api.supabase.com` semuanya di luar daftar itu, jadi deploy tidak bisa dijalankan otomatis dari sesi ini walau Anda memberi token API. Kalau macet di langkah manapun saat mengikuti panduan ini, kirim pesan error/screenshot-nya — perbaikan kode tetap bisa dibantu dari sini.
