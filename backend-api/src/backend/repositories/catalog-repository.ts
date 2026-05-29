import { and, eq, gt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { inventoryBalance, product, sku, unit } from "@/db/schema";

const baseUnit = alias(unit, "base_unit");
const saleUnit = alias(unit, "sale_unit");

export const catalogRepository = {
  findOutletCatalog(organizationId: string, outletId: string) {
    return db
      .select({
        productId: product.id,
        productName: product.name,
        category: product.category,
        skuId: sku.id,
        skuCode: sku.sku,
        barcode: sku.barcode,
        skuName: sku.name,
        price: sku.price,
        cost: sku.cost,
        baseUnitId: sku.baseUnitId,
        saleUnitId: sku.saleUnitId,
        saleUnitToBaseFactor: sku.saleUnitToBaseFactor,
        baseUnitCode: baseUnit.code,
        saleUnitCode: saleUnit.code,
        onHandBaseQty: inventoryBalance.onHandBaseQty,
        reservedBaseQty: inventoryBalance.reservedBaseQty,
      })
      .from(sku)
      .innerJoin(product, eq(product.id, sku.productId))
      .leftJoin(inventoryBalance, and(eq(inventoryBalance.skuId, sku.id), eq(inventoryBalance.outletId, outletId)))
      .leftJoin(baseUnit, eq(baseUnit.id, sku.baseUnitId))
      .leftJoin(saleUnit, eq(saleUnit.id, sku.saleUnitId))
      .where(and(eq(sku.organizationId, organizationId), eq(sku.isActive, true), eq(product.isActive, true)));
  },

  async pullChanges(organizationId: string, outletId: string, sinceDate: Date) {
    const products = await db
      .select()
      .from(product)
      .where(and(eq(product.organizationId, organizationId), gt(product.updatedAt, sinceDate)));
    const skus = await db
      .select()
      .from(sku)
      .where(and(eq(sku.organizationId, organizationId), gt(sku.updatedAt, sinceDate)));
    const units = await db
      .select()
      .from(unit)
      .where(and(eq(unit.organizationId, organizationId), gt(unit.updatedAt, sinceDate)));
    const balances = await db.select().from(inventoryBalance).where(eq(inventoryBalance.outletId, outletId));

    return {
      products,
      skus,
      units,
      balances,
    };
  },
};
