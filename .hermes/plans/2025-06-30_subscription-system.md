# Sistem Berlangganan (Subscription) — POS Cemilan

> **Hermes:** Gunakan subagent-driven-development untuk implementasi task-by-task.

**Goal:** Ubah POS Cemilan dari single-tenant self-hosted menjadi SaaS multi-tenant dengan superadmin yang mengelola langganan tiap tenant (organisasi). Superadmin = IT Support yang mengelola seluruh tenant.

**Architecture:** Tambahkan role `superadmin` di atas `owner`. Tambahkan tabel subscription_plan, tenant_subscription, subscription_payment. Superadmin login ke dashboard terpisah (`/superadmin`) untuk mengelola tenant dan langganan. Middleware cek status langganan di setiap request API tenant. Tenant dibuat oleh superadmin (bukan self-service). Superadmin tidak memiliki organizationId, hanya bisa akses dashboard superadmin.

**Tech Stack:** Next.js 16, React 19, Drizzle ORM, PostgreSQL 17, Better Auth, Tailwind 3

---

## Task 1: DB Migration — Tambah role superadmin dan tabel subscription

**Objective:** Buat enum role baru + 3 tabel subscription

**Step 1: Schema migration file**

Create: `backend-api/drizzle/0028_add_subscription.sql`

```sql
ALTER TYPE "app_role" ADD VALUE 'superadmin';

CREATE TABLE "subscription_plan" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,                    -- 'Basic', 'Pro', 'Enterprise'
  "code" text NOT NULL,                    -- 'basic', 'pro', 'enterprise'
  "price_monthly" numeric(14,2) NOT NULL DEFAULT '0',
  "price_yearly" numeric(14,2) NOT NULL DEFAULT '0',
  "max_outlets" integer NOT NULL DEFAULT 1,
  "max_users" integer NOT NULL DEFAULT 3,
  "max_skus" integer NOT NULL DEFAULT 50,
  "features" jsonb NOT NULL DEFAULT '{}', -- { "accounting": true, "sync": false }
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "tenant_subscription" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "plan_id" uuid NOT NULL REFERENCES "subscription_plan"("id"),
  "status" text NOT NULL DEFAULT 'trial'
    CHECK ("status" IN ('trial','active','grace_period','suspended','cancelled','expired')),
  "trial_ends_at" timestamptz,
  "current_period_start" timestamptz NOT NULL DEFAULT now(),
  "current_period_end" timestamptz NOT NULL,
  "billing_cycle" text NOT NULL DEFAULT 'monthly' CHECK ("billing_cycle" IN ('monthly','yearly')),
  "auto_renew" boolean NOT NULL DEFAULT true,
  "cancelled_at" timestamptz,
  "suspended_at" timestamptz,
  "suspended_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "subscription_org_idx" ON "tenant_subscription"("organization_id");
CREATE INDEX "subscription_status_idx" ON "tenant_subscription"("status");

CREATE TABLE "subscription_payment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_subscription_id" uuid NOT NULL REFERENCES "tenant_subscription"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "amount" numeric(14,2) NOT NULL,
  "method" text,                          -- 'transfer', 'cash'
  "reference" text,
  "period_start" timestamptz NOT NULL,
  "period_end" timestamptz NOT NULL,
  "status" text NOT NULL DEFAULT 'confirmed'
    CHECK ("status" IN ('pending','confirmed','failed')),
  "note" text,
  "paid_at" timestamptz DEFAULT now(),
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "payment_org_idx" ON "subscription_payment"("organization_id");
CREATE INDEX "payment_subscription_idx" ON "subscription_payment"("tenant_subscription_id");

-- Tambah kolom di organization
ALTER TABLE "organization"
  ADD COLUMN "contact_name" text,
  ADD COLUMN "contact_phone" text,
  ADD COLUMN "contact_email" text,
  ADD COLUMN "address" text,
  ADD COLUMN "is_active" boolean NOT NULL DEFAULT true;
```

**Step 2: Update Drizzle schema types**

Modify: `backend-api/src/backend/database/schema.ts`

Tambahkan setelah line 85 (sebelum `organization` table):

```typescript
export const appRoleEnum = pgEnum("app_role", [
  "superadmin",   // <-- NEW, taruh paling depan
  "owner",
  "admin_outlet",
  "cashier",
  "warehouse",
  "auditor",
]);
```

Tambahkan setelah `wasteAdjustment` table (sebelum `syncQueue`, ~line 885):

```typescript
export const subscriptionPlan = pgTable("subscription_plan", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  priceMonthly: numeric("price_monthly", { precision: 14, scale: 2 }).notNull().default("0"),
  priceYearly: numeric("price_yearly", { precision: 14, scale: 2 }).notNull().default("0"),
  maxOutlets: integer("max_outlets").notNull().default(1),
  maxUsers: integer("max_users").notNull().default(3),
  maxSkus: integer("max_skus").notNull().default(50),
  features: jsonb("features").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const tenantSubscription = pgTable("tenant_subscription", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlan.id),
  status: text("status").notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  autoRenew: boolean("auto_renew").notNull().default(true),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspendedReason: text("suspended_reason"),
  ...timestamps,
});

export const subscriptionPayment = pgTable("subscription_payment", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantSubscriptionId: uuid("tenant_subscription_id").notNull().references(() => tenantSubscription.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  method: text("method"),
  reference: text("reference"),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("confirmed"),
  note: text("note"),
  paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Update `organization` table — tambahkan 4 kolom baru setelah `posSettings`:

```typescript
// di dalam pgTable("organization", { ... })
contactName: text("contact_name"),
contactPhone: text("contact_phone"),
contactEmail: text("contact_email"),
address: text("address"),
isActive: boolean("is_active").notNull().default(true),
```

**Step 3: Update AppRole type export** (line 988)

```typescript
export type AppRole = (typeof appRoleEnum.enumValues)[number];
```

**Step 4: Run migration**

```bash
cd backend-api && docker compose up -d && npm run db:generate && npm run db:migrate
```

**Verifikasi:** `npm run db:studio` → cek tabel `subscription_plan`, `tenant_subscription`, `subscription_payment` ada, kolom `organization.is_active` ada.

---

## Task 2: Update RBAC + Role Access — Superadmin bypass

**Objective:** Superadmin bisa akses tanpa organizationId, semua route superadmin dilindungi

**Modify:** `backend-api/src/backend/lib/rbac.ts`

Update `roleRank` (line 21):
```typescript
export const roleRank: Record<AppRole, number> = {
  superadmin: 99,   // <-- NEW, di atas semua
  cashier: 10,
  warehouse: 20,
  auditor: 30,
  admin_outlet: 40,
  owner: 50,
};
```

Update `requireActor()` (line 33-64) — superadmin tidak wajib punya organizationId:
```typescript
export async function requireActor(request: Request): Promise<Actor> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    throw new ApiError("UNAUTHORIZED", "Authentication required", 401);
  }
  const [actor] = await accessRepository.findUserById(session.user.id);
  if (!actor) {
    throw new ApiError("UNAUTHORIZED", "User not found", 401);
  }
  if (!actor.isActive) {
    throw new ApiError("FORBIDDEN", "User is inactive", 403);
  }
  // Superadmin tidak punya organizationId
  if (actor.role !== "superadmin" && !actor.organizationId) {
    throw new ApiError("FORBIDDEN", "User is not assigned to an organization", 403);
  }
  return {
    id: actor.id, name: actor.name, email: actor.email,
    image: actor.image, role: actor.role,
    organizationId: actor.organizationId ?? "", // superadmin = ""
  };
}
```

**Modify:** `backend-api/src/backend/lib/role-access.ts`

Update `appRoles` (line 56):
```typescript
export const appRoles: AppRole[] = [
  "superadmin",   // <-- NEW
  "cashier", "warehouse", "auditor", "admin_outlet", "owner",
];
```

Update `roleLabels`:
```typescript
superadmin: "Superadmin",
```

Update `roleDescriptions`:
```typescript
superadmin: "IT Support yang mengelola seluruh tenant, langganan, dan sistem.",
```

**Verifikasi:** Build: `cd backend-api && npx next build` (tidak boleh error)

---

## Task 3: Seed data — Superadmin user + Subscription plans

**Objective:** Seed pertama kali buat superadmin + 3 plan default (Basic, Pro, Enterprise)

**Modify:** `backend-api/scripts/seed.ts`

Tambahkan di `main()` setelah line 13 (sebelum create organization pertama):

```typescript
// 1. Seed superadmin
const saEmail = process.env.SEED_SUPERADMIN_EMAIL ?? "it@email.com";
const saPassword = process.env.SEED_SUPERADMIN_PASSWORD ?? "Pwd!12345.";

let [superadmin] = await db.select().from(user).where(eq(user.email, saEmail)).limit(1);
if (!superadmin) {
  await auth.api.signUpEmail({
    body: { email: saEmail, password: saPassword, name: "IT Support" },
  });
  [superadmin] = await db.select().from(user).where(eq(user.email, saEmail)).limit(1);
}
await db.update(user).set({ role: "superadmin", isActive: true, updatedAt: new Date() })
  .where(eq(user.id, superadmin!.id));

// 2. Seed subscription plans
const plans = [
  { name: "Basic", code: "basic", priceMonthly: "0", priceYearly: "0", maxOutlets: 1, maxUsers: 3, maxSkus: 50 },
  { name: "Pro", code: "pro", priceMonthly: "150000", priceYearly: "1500000", maxOutlets: 5, maxUsers: 20, maxSkus: 500 },
  { name: "Enterprise", code: "enterprise", priceMonthly: "500000", priceYearly: "5000000", maxOutlets: 999, maxUsers: 999, maxSkus: 99999 },
];
for (const plan of plans) {
  const [existing] = await db.select().from(subscriptionPlan).where(eq(subscriptionPlan.code, plan.code)).limit(1);
  if (!existing) {
    await db.insert(subscriptionPlan).values(plan);
  }
}
```

Tambahkan import di atas:
```typescript
import { subscriptionPlan } from "@/db/schema";
```

**Verifikasi:** `npm run db:seed` → check `it@email.com` ada dengan role superadmin, 3 plans ada.

---

## Task 4: Subscription enforcement middleware

**Objective:** Setiap request API tenant dicek status langganannya. Trial expired → 402. Suspended → 403.

**Create:** `backend-api/src/backend/lib/subscription-guard.ts`

```typescript
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantSubscription } from "@/db/schema";
import { ApiError } from "@/lib/http";
import type { Actor } from "@/lib/rbac";

export async function requireActiveSubscription(actor: Actor) {
  if (actor.role === "superadmin") return; // superadmin always passes

  const [subscription] = await db
    .select()
    .from(tenantSubscription)
    .where(eq(tenantSubscription.organizationId, actor.organizationId))
    .limit(1);

  if (!subscription) {
    // No subscription at all — block
    throw new ApiError("SUBSCRIPTION_REQUIRED", "Organisasi belum memiliki langganan aktif", 402);
  }

  const now = new Date();

  switch (subscription.status) {
    case "active":
    case "trial":
      // Check if trial expired
      if (subscription.trialEndsAt && new Date(subscription.trialEndsAt) < now) {
        throw new ApiError("TRIAL_EXPIRED", "Masa uji coba telah berakhir", 402);
      }
      break;
    case "grace_period":
      // Allow 7 days grace after period end
      if (new Date(subscription.currentPeriodEnd) < new Date(now.getTime() - 7 * 86400000)) {
        throw new ApiError("SUBSCRIPTION_EXPIRED", "Langganan telah berakhir dan masa tenggang habis", 402);
      }
      break;
    case "suspended":
      throw new ApiError("SUBSCRIPTION_SUSPENDED",
        subscription.suspendedReason ?? "Langganan ditangguhkan", 403);
    case "cancelled":
    case "expired":
      throw new ApiError("SUBSCRIPTION_ENDED", "Langganan telah berakhir", 402);
  }
}
```

**Integrasi ke route:** Pilih satu route penting dulu — `app/api/sales/route.ts` (POST handler). Baca file, tambahkan check subscription setelah `requireActor`.

```typescript
// Di dalam handler POST
const actor = await requireActor(request);
await requireActiveSubscription(actor);
```

**Verifikasi:** Build: `npx next build`. Jalankan dev, coba API call sebagai superadmin (harus lolos), sebagai owner tanpa subscription (harus 402).

---
