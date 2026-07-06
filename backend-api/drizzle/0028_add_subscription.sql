ALTER TYPE "app_role" ADD VALUE IF NOT EXISTS 'superadmin';

ALTER TABLE "organization"
  ADD COLUMN IF NOT EXISTS "contact_name" text,
  ADD COLUMN IF NOT EXISTS "contact_phone" text,
  ADD COLUMN IF NOT EXISTS "contact_email" text,
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "subscription_plan" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "code" text NOT NULL,
  "price_monthly" numeric(14,2) NOT NULL DEFAULT '0',
  "price_yearly" numeric(14,2) NOT NULL DEFAULT '0',
  "max_outlets" integer NOT NULL DEFAULT 1,
  "max_users" integer NOT NULL DEFAULT 3,
  "max_skus" integer NOT NULL DEFAULT 50,
  "features" jsonb NOT NULL DEFAULT '{}',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tenant_subscription" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "plan_id" uuid NOT NULL REFERENCES "subscription_plan"("id"),
  "status" text NOT NULL DEFAULT 'trial',
  "trial_ends_at" timestamptz,
  "current_period_start" timestamptz NOT NULL DEFAULT now(),
  "current_period_end" timestamptz NOT NULL,
  "billing_cycle" text NOT NULL DEFAULT 'monthly',
  "auto_renew" boolean NOT NULL DEFAULT true,
  "cancelled_at" timestamptz,
  "suspended_at" timestamptz,
  "suspended_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_org_idx" ON "tenant_subscription"("organization_id");
CREATE INDEX IF NOT EXISTS "subscription_status_idx" ON "tenant_subscription"("status");

CREATE TABLE IF NOT EXISTS "subscription_payment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_subscription_id" uuid NOT NULL REFERENCES "tenant_subscription"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "amount" numeric(14,2) NOT NULL,
  "method" text,
  "reference" text,
  "period_start" timestamptz NOT NULL,
  "period_end" timestamptz NOT NULL,
  "status" text NOT NULL DEFAULT 'confirmed',
  "note" text,
  "paid_at" timestamptz DEFAULT now(),
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payment_org_idx" ON "subscription_payment"("organization_id");
CREATE INDEX IF NOT EXISTS "payment_subscription_idx" ON "subscription_payment"("tenant_subscription_id");
