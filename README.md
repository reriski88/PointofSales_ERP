# POS Cemilan App Workspace

Struktur aplikasi di folder `App`:

```text
App/
  backend-api/   Next.js API lokal, PostgreSQL, Drizzle ORM, Better Auth, Tailwind CSS
  kasir_flutter/ Flutter APK kasir untuk mobile
```

## Backend API

```powershell
cd backend-api
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Backend lokal berjalan di `http://localhost:3000`.

Login admin:

```text
Email: admin@email.com
Password: Pwd!12345
```

Dashboard backend:

- `http://localhost:3000/admin` untuk ringkasan operasional.
- `http://localhost:3000/admin/outlets` untuk membuat dan melihat outlet.
- `http://localhost:3000/admin/users` untuk membuat user dan mengatur akses outlet.
- `http://localhost:3000/admin/products` untuk membuat dan melihat produk/SKU.
- `http://localhost:3000/admin/inventory` untuk monitoring stok produk masing-masing outlet.
- `http://localhost:3000/admin/reports` untuk laporan penjualan, stok, dan waste/remahan.

Master produk dibuat dari backend dashboard. Transaksi kasir, shift, dan sync offline dilakukan dari Flutter APK kasir.

## Flutter APK Kasir

```powershell
cd kasir_flutter
flutter run
```

Flutter diarahkan ke URL backend lokal atau URL HTTPS Cloudflare Tunnel saat PC backend di-online-kan.
