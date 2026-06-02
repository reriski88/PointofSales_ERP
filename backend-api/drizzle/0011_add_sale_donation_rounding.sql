ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "donation_total" numeric(14, 2) NOT NULL DEFAULT '0';
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "rounding_total" numeric(14, 2) NOT NULL DEFAULT '0';
