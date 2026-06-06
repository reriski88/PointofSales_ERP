ALTER TABLE "product" ADD COLUMN "global_product_id" uuid;
ALTER TABLE "sku" ADD COLUMN "global_sku_id" uuid;

UPDATE "product"
SET "global_product_id" = "id"
WHERE "global_product_id" IS NULL;

UPDATE "sku"
SET "global_sku_id" = "id"
WHERE "global_sku_id" IS NULL;

CREATE INDEX "product_global_idx" ON "product"("organization_id", "global_product_id");
CREATE INDEX "sku_global_idx" ON "sku"("organization_id", "global_sku_id");
