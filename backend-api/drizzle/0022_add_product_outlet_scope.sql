ALTER TABLE "product" ADD COLUMN "outlet_id" uuid REFERENCES "outlet"("id") ON DELETE SET NULL;

UPDATE "product" p
SET "outlet_id" = scoped."outlet_id"
FROM (
  SELECT s."product_id", min(ib."outlet_id"::text)::uuid AS "outlet_id"
  FROM "sku" s
  INNER JOIN "inventory_balance" ib ON ib."sku_id" = s."id"
  GROUP BY s."product_id"
) scoped
WHERE scoped."product_id" = p."id"
  AND p."outlet_id" IS NULL;

CREATE INDEX "product_org_outlet_idx" ON "product"("organization_id", "outlet_id");
