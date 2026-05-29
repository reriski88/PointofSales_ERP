# POS Cemilan Backend

Backend API untuk POS Jualan Cemilan. Backend berjalan di PC lokal, memakai Next.js Route Handlers, PostgreSQL, Drizzle ORM, Better Auth, Tailwind CSS, dan komponen UI bergaya shadcn. API dapat dipublikasikan lewat Cloudflare Tunnel.

## Setup Lokal

1. Salin `.env.example` menjadi `.env`.
2. Jalankan PostgreSQL:

```powershell
docker compose up -d
```

3. Install dependency:

```powershell
npm install
```

4. Generate dan jalankan migrasi:

```powershell
npm run db:generate
npm run db:migrate
```

5. Seed owner dan outlet awal:

```powershell
npm run db:seed
```

6. Jalankan backend:

```powershell
npm run dev
```

API tersedia di `http://localhost:3000`.

Panel admin tersedia di `http://localhost:3000/admin/login`.

## Struktur Direktori

Project dipisah menjadi backend dan frontend di dalam `src/`, sementara `app/` tetap dipakai sebagai adapter routing Next.js:

- `src/backend/database`: koneksi Drizzle dan schema database.
- `src/backend/repositories`: akses data/query database.
- `src/backend/services`: business logic yang memakai repository.
- `src/backend/lib`: helper backend seperti auth, RBAC, validasi, dan HTTP response.
- `src/frontend/controllers`: controller frontend yang diekspor oleh route Next.js.
- `src/frontend/models`: tipe/model untuk kebutuhan frontend.
- `src/frontend/views`: halaman, komponen UI, dan view admin.
- `app/api`: route handler API.
- `app/admin`: adapter route admin yang memanggil controller frontend.

Jika memakai aplikasi pgAdmin4 desktop, register server dengan koneksi berikut:

```text
Host: localhost
Port: 5432
Maintenance database: pos_cemilan
Username: pos_cemilan
Password: pos_cemilan
```

Login admin awal:

```text
Email: admin@email.com
Password: Pwd!12345
```

Halaman dashboard:

- `/admin` ringkasan backend.
- `/admin/outlets` tambah/list outlet.
- `/admin/users` tambah/list user kasir, admin outlet, gudang, auditor, dan owner.
- `/admin/products` tambah/list produk dan SKU.
- `/admin/inventory` monitoring stok produk per outlet dan mutasi terakhir.
- `/admin/reports` laporan sales, inventory, dan waste/remahan.

Produk dibuat dari dashboard backend. APK kasir fokus untuk transaksi, shift, sync offline, dan operasional kasir.

## Cloudflare Tunnel

Untuk akses dari luar jaringan tanpa membeli server, jalankan:

```powershell
npm run dev:public
```

Script ini akan:

- menjalankan PostgreSQL Docker,
- menjalankan backend di `http://localhost:3000` jika belum aktif,
- mengunduh `cloudflared.exe` lokal ke folder `tools/` jika belum ada,
- membuka Cloudflare Tunnel publik.

Jika belum memakai Cloudflare Named Tunnel, script akan memakai Quick Tunnel. Salin URL `https://*.trycloudflare.com` yang tampil di terminal, atau lihat file:

```text
public-url.txt
```

URL Quick Tunnel `trycloudflare.com` bersifat dinamis dari Cloudflare dan dapat berubah setiap tunnel direstart.

Jika backend sudah berjalan dan hanya ingin membuka tunnel:

```powershell
npm run tunnel
```

### URL Publik Tetap

Quick Tunnel `*.trycloudflare.com` tidak bisa dibuat konstan dari project lokal. Untuk URL tetap, buat Cloudflare Named Tunnel di dashboard Cloudflare, arahkan hostname tetap ke backend, lalu isi `.env`:

```text
PUBLIC_APP_URL=https://api.domain-anda.com
CLOUDFLARE_TUNNEL_TOKEN=token-dari-cloudflare
```

Setelah itu jalankan:

```powershell
npm run dev:public
```

Script akan memakai token named tunnel tersebut dan menyimpan URL tetap ke `public-url.txt`.

### Link Tetap yang Membungkus Quick Tunnel

Jika tetap ingin memakai Quick Tunnel yang dinamis, tetapi link yang dibagikan terlihat tetap, gunakan Cloudflare Worker proxy di folder:

```text
cloudflare-worker/
```

Konsepnya:

```text
https://pos-cemilan.namaakun.workers.dev/admin/reports
  -> membaca target terbaru dari Cloudflare KV
  -> meneruskan request ke https://*.trycloudflare.com/admin/reports
```

Deploy Worker:

```powershell
cd cloudflare-worker
npx wrangler login
npx wrangler kv namespace create TUNNEL_TARGETS
copy wrangler.toml.example wrangler.toml
# isi id KV namespace di wrangler.toml
npx wrangler deploy
cd ..
```

Atau dari root backend setelah `wrangler.toml` siap:

```powershell
npm run worker:deploy
```

Lalu isi `.env` backend:

```text
PUBLIC_APP_URL=https://pos-cemilan.namaakun.workers.dev
CLOUDFLARE_ACCOUNT_ID=isi-account-id
CLOUDFLARE_API_TOKEN=isi-api-token
CLOUDFLARE_KV_NAMESPACE_ID=isi-kv-namespace-id
CLOUDFLARE_KV_TARGET_KEY=current-url
```

API token Cloudflare perlu izin edit Workers KV Storage. Setelah itu jalankan:

```powershell
npm run dev:public
```

Setiap URL Quick Tunnel berubah, script akan update target di KV. User tetap membuka `PUBLIC_APP_URL`.

Secara manual, origin tunnel diarahkan ke:

```text
http://localhost:3000
```

Flutter APK memakai URL HTTPS dari Cloudflare sebagai base API. Jika PC mati/offline atau terminal tunnel ditutup, API tidak dapat diakses dan Flutter perlu menahan transaksi di antrean offline.

## URL Publik di Database

Setiap `npm run dev:public` atau `npm run tunnel` mendapat URL publik aktif, script akan:

- menyimpan URL ke `public-url.txt`,
- menyimpan URL ke kolom `organization.public_api_url`,
- menyediakan URL tersebut lewat endpoint:

```text
GET /api/public-url
```

Jika memakai Quick Tunnel, nilai yang tersimpan adalah URL `https://*.trycloudflare.com` terbaru. Jika memakai Worker wrapper tetap dengan `PUBLIC_APP_URL`, nilai yang tersimpan adalah URL Worker tetap.

Endpoint update internal:

```text
POST /api/public-url
Header: x-public-url-update-token
Body: { "publicApiUrl": "https://..." }
```

Token memakai `PUBLIC_URL_UPDATE_TOKEN`; jika kosong, script memakai `BETTER_AUTH_SECRET`.

## Endpoint Penting

- `GET /api/health`
- `GET /api/public-url`
- `GET /api/openapi.json`
- `POST /api/auth/sign-in/email`
- `GET /api/auth/get-session`
- `POST /api/sales`
- `POST /api/sync/push`
