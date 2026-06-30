CREATE INDEX IF NOT EXISTS "product_outlet_active_updated_idx" ON "product" ("outlet_id", "is_active", "updated_at");
CREATE INDEX IF NOT EXISTS "sku_product_active_updated_idx" ON "sku" ("product_id", "is_active", "updated_at");
