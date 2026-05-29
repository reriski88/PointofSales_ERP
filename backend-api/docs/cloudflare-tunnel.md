# Cloudflare Tunnel untuk Backend Lokal

Backend ini memang dirancang berjalan di PC lokal. Agar Flutter APK bisa mengakses API dari internet, gunakan Cloudflare Tunnel ke origin lokal:

```text
http://localhost:3000
```

Konsep:

```text
Flutter APK
  -> HTTPS Cloudflare Tunnel
  -> PC lokal owner
  -> Next.js Route Handlers
  -> PostgreSQL lokal
```

Jika PC mati, internet putus, Docker berhenti, atau backend tidak berjalan, API otomatis tidak dapat diakses. Flutter harus menyimpan transaksi offline dan mengirimnya lagi ke `/api/sync/push` saat API tersedia.

## Checklist

- Jalankan PostgreSQL: `docker compose up -d`
- Jalankan backend: `npm run dev`
- Pastikan health check lokal OK: `GET http://localhost:3000/api/health`
- Panel admin lokal: `http://localhost:3000/admin/login`
- Buat tunnel Cloudflare ke `http://localhost:3000`
- Set `BETTER_AUTH_URL` ke URL HTTPS tunnel/domain
- Tambahkan origin Flutter/deep link ke `TRUSTED_ORIGINS`
- Flutter memakai base URL HTTPS dari tunnel
