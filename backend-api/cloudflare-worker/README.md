# POS Cemilan Cloudflare Worker Proxy

Worker ini membuat URL tetap yang membungkus URL Quick Tunnel `trycloudflare.com`.

Alurnya:

```text
https://pos-cemilan.<akun>.workers.dev/admin/reports
  -> membaca target dari KV key current-url
  -> meneruskan request ke https://*.trycloudflare.com/admin/reports
```

## Deploy

1. Login Cloudflare Wrangler:

```powershell
npx wrangler login
```

2. Buat KV namespace:

```powershell
npx wrangler kv namespace create TUNNEL_TARGETS
```

3. Salin `wrangler.toml.example` menjadi `wrangler.toml`, lalu isi `id` dari hasil langkah 2.

4. Deploy Worker:

```powershell
cd cloudflare-worker
npx wrangler deploy
```

5. Isi `.env` backend:

```text
PUBLIC_APP_URL=https://pos-cemilan.<akun>.workers.dev
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_KV_NAMESPACE_ID=...
CLOUDFLARE_KV_TARGET_KEY=current-url
```

API token perlu izin edit Workers KV Storage. Setelah itu jalankan:

```powershell
npm run dev:public
```

Setiap URL Quick Tunnel berubah, script backend akan update target KV, sementara URL Worker tetap sama.
