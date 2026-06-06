# Smart POS App Workspace

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

## Panduan Produk dan Satuan

Aplikasi dibuat agar user pemula tidak perlu memahami istilah teknis stok terlalu dalam. Saat membuat produk, mulai dari pilihan cara jual:

- **Kemasan Berat**: contoh keripik 250g dijual per `pack`.
- **Berat Curah**: contoh gula dijual per `kg`, `ons`, atau `g`.
- **Pcs / Satuan**: contoh roti dijual per `pcs`.
- **Non-stok**: contoh jasa, biaya packing, atau item yang tidak memotong stok.

Aturan pengisian satuan:

- Ukuran kemasan ditulis di **nama varian**, bukan di master satuan.
- Master satuan tetap pendek dan umum, misalnya `g`, `ons`, `kg`, `pcs`, `pack`.
- Untuk produk kemasan, contoh ideal:

```text
Nama produk: Keripik Pisang
Nama varian: Keripik Pisang 250g
Satuan dasar stok: g
Satuan jual: pack
Isi per pack: 250
Harga jual: 15000
```

Struk/kasir akan tampil:

```text
Keripik Pisang 250g
1 pack x Rp15.000
```

Stok akan terpotong:

```text
1 pack = 250 g
```

Untuk varian lain, buat SKU/varian berbeda:

```text
Keripik Pisang 500g
1 pack = 500 g
```

Jangan membuat master satuan `pack 250g` atau `pack 500g`. Cukup buat master satuan `pack`, lalu bedakan ukuran lewat nama varian dan konversi produk.

## Flutter APK Kasir

```powershell
cd kasir_flutter
flutter run
```

Flutter diarahkan ke URL backend lokal atau URL HTTPS Cloudflare Tunnel saat PC backend di-online-kan.
