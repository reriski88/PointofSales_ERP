# Smart POS Backend

Backend API untuk Smart POS. Backend berjalan di PC lokal, memakai Next.js Route Handlers, PostgreSQL, Drizzle ORM, Better Auth, Tailwind CSS, dan komponen UI bergaya shadcn.

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

## Produk, Varian, dan Satuan

Halaman `/admin/products` memakai alur ramah pemula. Admin memilih template cara jual sebelum mengisi produk:

- **Kemasan Berat** untuk produk seperti keripik 250g/500g yang dijual per pack.
- **Berat Curah** untuk produk yang dijual per gram, ons, atau kilogram.
- **Pcs / Satuan** untuk produk yang dijual per buah/pcs.
- **Non-stok** untuk jasa, biaya tambahan, atau item yang tidak perlu inventory.

Prinsip satuan:

- `unit.code` adalah kode pendek untuk kasir, struk, dan laporan, misalnya `g`, `ons`, `kg`, `pcs`, `pack`.
- `unit.toBaseFactor` dipakai untuk konversi umum antar satuan yang nilainya tetap, misalnya `kg = 1000 g`.
- Ukuran kemasan yang berbeda tidak dibuat sebagai master satuan. Gunakan nama SKU/varian dan `sku.saleUnitToBaseFactor`.

Contoh kemasan berat:

```text
Product.name: Keripik Pisang
SKU.name: Keripik Pisang 250g
SKU.baseUnitId: g
SKU.saleUnitId: pack
SKU.saleUnitToBaseFactor: 250
SKU.price: 15000
```

Kasir dan struk menampilkan nama SKU dan kode satuan jual:

```text
Keripik Pisang 250g
1 pack x Rp15.000
```

Inventory tetap memakai satuan dasar:

```text
1 pack = 250 g
```

Untuk ukuran lain, buat SKU berbeda:

```text
Keripik Pisang 500g
1 pack = 500 g
```

Dengan aturan ini, master satuan tetap bersih dan user awam cukup mengisi nama varian, satuan jual, dan isi per satuan jual.

## Endpoint Penting

- `GET /api/health`
- `GET /api/openapi.json`
- `POST /api/auth/sign-in/email`
- `GET /api/auth/get-session`
- `POST /api/sales`
- `POST /api/sync/push`
