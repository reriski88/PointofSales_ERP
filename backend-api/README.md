# POS Cemilan Backend

Backend API untuk POS Jualan Cemilan. Backend berjalan di PC lokal, memakai Next.js Route Handlers, PostgreSQL, Drizzle ORM, Better Auth, Tailwind CSS, dan komponen UI bergaya shadcn.

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

## Endpoint Penting

- `GET /api/health`
- `GET /api/openapi.json`
- `POST /api/auth/sign-in/email`
- `GET /api/auth/get-session`
- `POST /api/sales`
- `POST /api/sync/push`
