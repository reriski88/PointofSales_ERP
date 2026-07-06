# Sistem Berlangganan (Subscription) — Part 2 (Task 5-9)

> **Lanjutan dari:** `.hermes/plans/2025-06-30_subscription-system.md`

---

## Task 5: Superadmin dashboard — Halaman dasar + navigasi

**Objective:** Superadmin login ke `/superadmin`, lihat dashboard tenant management

**Create:** `backend-api/app/superadmin/layout.tsx`

```tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/admin/login");
  
  // Fetch user role — implement via API or direct DB
  // TODO: Add superadmin check
  return (
    <div className="flex min-h-screen">
      <SuperadminSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

**Step 1: Buat halaman dasar**

Create: `backend-api/app/superadmin/page.tsx`

```tsx
import { db } from "@/db";
import { organization, tenantSubscription, subscriptionPlan } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card } from "@/components/ui/card";

export default async function SuperadminDashboardPage() {
  const orgs = await db.select().from(organization);
  const subs = await db
    .select({
      orgName: organization.name,
      status: tenantSubscription.status,
      planName: subscriptionPlan.name,
      periodEnd: tenantSubscription.currentPeriodEnd,
    })
    .from(tenantSubscription)
    .innerJoin(organization, eq(organization.id, tenantSubscription.organizationId))
    .innerJoin(subscriptionPlan, eq(subscriptionPlan.id, tenantSubscription.planId));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard Superadmin</h1>
      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total Tenant</div>
          <div className="text-3xl font-bold">{orgs.length}</div>
        </Card>
        {/* ... more stats */}
      </div>
      {/* Recent tenants table */}
      <h2 className="text-lg font-semibold mb-4">Langganan Terbaru</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">Tenant</th>
            <th className="p-2">Plan</th>
            <th className="p-2">Status</th>
            <th className="p-2">Berakhir</th>
          </tr>
        </thead>
        <tbody>
          {subs.map((s, i) => (
            <tr key={i} className="border-b">
              <td className="p-2">{s.orgName}</td>
              <td className="p-2">{s.planName}</td>
              <td className="p-2">{s.status}</td>
              <td className="p-2">{s.periodEnd?.toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Verifikasi:** `npx next build`, buka `http://localhost:3000/superadmin` setelah login sebagai superadmin.

---

## Task 6: Superadmin API — CRUD Tenant + Subscription

**Objective:** API routes untuk superadmin mengelola tenant dan subscription

**Create:** `backend-api/app/api/superadmin/tenants/route.ts`

```typescript
import { NextRequest } from "next/server";
import { db } from "@/db";
import { organization, tenantSubscription, subscriptionPlan, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { ok, handleRouteError, ApiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    // Auth check — superadmin only
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) throw new ApiError("UNAUTHORIZED", "", 401);
    
    const [actor] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
    if (actor?.role !== "superadmin") throw new ApiError("FORBIDDEN", "", 403);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.toLowerCase();

    const tenants = await db
      .select({
        id: organization.id,
        name: organization.name,
        contactName: organization.contactName,
        contactPhone: organization.contactPhone,
        contactEmail: organization.contactEmail,
        isActive: organization.isActive,
        createdAt: organization.createdAt,
        subStatus: tenantSubscription.status,
        subPlanName: subscriptionPlan.name,
        subPeriodEnd: tenantSubscription.currentPeriodEnd,
      })
      .from(organization)
      .leftJoin(tenantSubscription, eq(tenantSubscription.organizationId, organization.id))
      .leftJoin(subscriptionPlan, eq(subscriptionPlan.id, tenantSubscription.planId))
      .limit(100);

    return ok(tenants);
  } catch (error) {
    return handleRouteError(error);
  }
}
```

**Create:** `backend-api/app/api/superadmin/tenants/[id]/route.ts`
- PATCH: update organization (name, contact info, isActive)
- GET: detail satu tenant

**Create:** `backend-api/app/api/superadmin/tenants/[id]/subscription/route.ts`
- GET: subscription detail + payment history
- PATCH: update plan, extend period, change status
- POST: record payment

**Create:** `backend-api/app/api/superadmin/plans/route.ts`
- GET: list all plans
- POST: create new plan
- PATCH: update plan

**Verifikasi:** Buat curl test — POST buat tenant baru, PATCH subscription, GET list.

---

## Task 7: Halaman Superadmin — Tenant List + Detail

**Objective:** UI superadmin untuk melihat daftar tenant, edit tenant, kelola langganan

**Create:** `backend-api/src/frontend/views/superadmin/tenants-client.tsx` 
- Client component dengan tabel tenant (search, filter status)
- Button "Tambah Tenant" → modal create
- Button "Kelola Langganan" → navigasi ke detail

**Create:** `backend-api/src/frontend/views/superadmin/tenant-detail-client.tsx`
- Detail tenant + subscription info
- Form ganti plan
- Form perpanjang langganan
- Tabel payment history
- Button suspend/unsuspend

**Create:** `backend-api/src/frontend/controllers/superadmin/tenants.tsx`
- Server component wrapper untuk data fetching

**Routes:**
- `app/superadmin/tenants/page.tsx` → tenant list
- `app/superadmin/tenants/[id]/page.tsx` → tenant detail

**Verifikasi:** `npx next build`, buka `/superadmin/tenants`, pastikan list tampil, bisa klik detail tenant.

---

## Task 8: Create Tenant Flow (Superadmin)

**Objective:** Superadmin bisa membuat tenant baru: buat organization + owner user + subscription + outlet awal

**Create:** `backend-api/app/api/superadmin/tenants/create/route.ts`

```typescript
// POST handler — transactional
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // 1. Validasi: name, ownerEmail, ownerPassword, planId
    // 2. Transaction:
    //    a. Create organization (name, contact info)
    //    b. Sign up owner user via auth.api (email + password)
    //    c. Set user role = owner, organizationId
    //    d. Create tenant_subscription (planId, status=trial, trialEndsAt = now+14d)
    //    e. Create default outlet "Outlet Utama"
    //    f. Assign owner to outlet via user_outlet
    // 3. Return created tenant info
  } catch (error) {
    return handleRouteError(error);
  }
}
```

**Frontend modal:** Tambahkan di `tenants-client.tsx` — form dengan field: nama tenant, nama owner, email owner, password, pilih plan, durasi trial.

**Verifikasi:** Buat tenant baru via UI `/superadmin/tenants`, login sebagai owner tenant baru ke `/admin`, pastikan bisa akses.

---

## Task 9: Integrasi subscription guard ke semua route API

**Objective:** Semua API route tenant dicek subscription-nya

**Approach:** Buat wrapper helper, tambahkan di setiap handler yang butuh.

**Create:** `backend-api/src/backend/lib/with-subscription.ts`

```typescript
import type { Actor } from "@/lib/rbac";
import { requireActiveSubscription } from "@/lib/subscription-guard";

type RouteHandler = (actor: Actor, request: Request, ...args: any[]) => Promise<Response>;

export function withSubscription(handler: RouteHandler): RouteHandler {
  return async (actor, request, ...args) => {
    await requireActiveSubscription(actor);
    return handler(actor, request, ...args);
  };
}
```

**Integrasi bertahap — priority routes:**
1. `app/api/sales/route.ts` (POST, GET)
2. `app/api/shifts/*/route.ts` (open, close)
3. `app/api/products/route.ts` (POST, PATCH)
4. `app/api/inventory/*/route.ts`
5. `app/api/purchases/route.ts`
6. `app/api/reports/*/route.ts`

Pattern di setiap handler:
```typescript
const actor = await requireActor(request);
await requireActiveSubscription(actor);
// ... rest of handler
```

**Verifikasi:** `npx next build`. Jalankan 2 tenant: satu active, satu expired. Test API call dari masing-masing — active harus lolos, expired harus 402.

---

## Rencana Bertahap (Prioritas)

| Task | Deskripsi | Estimasi |
|------|-----------|----------|
| 1 | DB migration + schema | 20 menit |
| 2 | RBAC superadmin | 10 menit |
| 3 | Seed data | 10 menit |
| 4 | Subscription guard | 15 menit |
| 5 | Superadmin dashboard dasar | 20 menit |
| 6 | Superadmin API CRUD | 25 menit |
| 7 | Superadmin UI pages | 30 menit |
| 8 | Create tenant flow | 20 menit |
| 9 | Integrasi guard seluruh route | 25 menit |

**Total estimasi:** ~3 jam

---

## Risks & Tradeoffs

1. **Enum ALTER pada DB existing berisiko** — `ALTER TYPE ADD VALUE` aman di PostgreSQL 9.1+, tapi tidak bisa di-rollback. Backup dulu.
2. **Superadmin tanpa organizationId** — pastikan semua query yang join ke organization pakai LEFT JOIN, bukan INNER JOIN, atau filter `actor.role !== "superadmin"`.
3. **Subscription guard per-route** — bisa jadi bottleneck query kalau setiap request query subscription. Pertimbangkan cache in-memory (TTL 5 menit) di iterasi berikutnya.
4. **No self-service signup** — tenant dibuat oleh superadmin. Kalau nanti mau self-service, tambah landing page + `POST /api/register`.
5. **Plan limit enforcement** (max_outlets, max_users, max_skus) — belum diimplementasi di task ini. Bisa ditambahkan sebagai guard terpisah.

---

## Open Questions

1. **Payment gateway?** Saat ini payment dicatat manual (transfer/cash). Apakah perlu integrasi Midtrans/Xendit?
2. **Notifikasi expired?** Apakah perlu kirim email/WhatsApp ke owner saat trial mau habis?
3. **White-label?** Apakah tenant bisa custom domain/logo? (organization.logoUrl sudah ada)
4. **Data retention after cancel?** Berapa lama data tenant disimpan setelah cancel?
5. **Multi-outlet pricing?** Apakah per-outlet atau per-tenant?

---

## File yang Berubah

**New files (11):**
- `drizzle/0028_add_subscription.sql`
- `src/backend/lib/subscription-guard.ts`
- `src/backend/lib/with-subscription.ts`
- `app/superadmin/layout.tsx`
- `app/superadmin/page.tsx`
- `app/superadmin/tenants/page.tsx`
- `app/superadmin/tenants/[id]/page.tsx`
- `app/api/superadmin/tenants/route.ts`
- `app/api/superadmin/tenants/[id]/route.ts`
- `app/api/superadmin/tenants/[id]/subscription/route.ts`
- `app/api/superadmin/tenants/create/route.ts`
- `app/api/superadmin/plans/route.ts`
- `src/frontend/views/superadmin/tenants-client.tsx`
- `src/frontend/views/superadmin/tenant-detail-client.tsx`
- `src/frontend/controllers/superadmin/tenants.tsx`

**Modified files (5):**
- `src/backend/database/schema.ts` — tambah tabel + kolom
- `src/backend/lib/rbac.ts` — superadmin role rank + bypass org
- `src/backend/lib/role-access.ts` — tambah superadmin di appRoles
- `scripts/seed.ts` — seed superadmin + plans
- `src/frontend/views/admin/_components/admin-nav.tsx` — redirect superadmin

**Modified API routes (6+):**
- `app/api/sales/route.ts`
- `app/api/shifts/*/route.ts`
- `app/api/products/route.ts`
- `app/api/inventory/*/route.ts`
- `app/api/purchases/route.ts`
- `app/api/reports/*/route.ts`
