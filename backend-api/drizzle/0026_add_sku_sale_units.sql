ALTER TABLE "sku" ADD COLUMN IF NOT EXISTS "sale_unit_id" uuid;
ALTER TABLE "sku" ADD COLUMN IF NOT EXISTS "sale_unit_to_base_factor" numeric(18, 6) DEFAULT '1' NOT NULL;

UPDATE "sku"
SET "sale_unit_id" = "base_unit_id"
WHERE "sale_unit_id" IS NULL;

ALTER TABLE "sku" ALTER COLUMN "sale_unit_id" SET NOT NULL;
DO $$ BEGIN
 ALTER TABLE "sku" ADD CONSTRAINT "sku_sale_unit_id_unit_id_fk" FOREIGN KEY ("sale_unit_id") REFERENCES "unit"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
