ALTER TABLE "sku" ADD COLUMN IF NOT EXISTS "track_inventory" boolean DEFAULT true NOT NULL;
ALTER TABLE "sku" ADD COLUMN IF NOT EXISTS "quantity_mode" text DEFAULT 'required' NOT NULL;

UPDATE "sku"
SET "track_inventory" = true
WHERE "track_inventory" IS NULL;

UPDATE "sku"
SET "quantity_mode" = 'required'
WHERE "quantity_mode" IS NULL OR "quantity_mode" NOT IN ('required', 'fixed_one');

UPDATE "sku"
SET "quantity_mode" = 'required'
WHERE "track_inventory" = false;
