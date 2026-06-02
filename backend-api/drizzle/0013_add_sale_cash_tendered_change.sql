ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "cash_tendered_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "change_total" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
UPDATE "sale"
SET "cash_tendered_total" = coalesce((
  SELECT sum("payment"."amount")
  FROM "payment"
  WHERE "payment"."sale_id" = "sale"."id"
    AND "payment"."method" = 'cash'
), 0)
WHERE "cash_tendered_total" = 0;
