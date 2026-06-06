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
        globalProductId: product.globalProductId,
        productName: product.name,
        productImageUrl: product.imageUrl,
        category: product.category,
        skuId: sku.id,
        globalSkuId: sku.globalSkuId,
        skuCode: sku.sku,
        barcode: sku.barcode,
        skuName: sku.name,
        skuImageUrl: sku.imageUrl,
        price: sku.price,
        cost: sku.cost,
        baseUnitId: sku.baseUnitId,
        saleUnitId: sku.saleUnitId,
        saleUnitToBaseFactor: sku.saleUnitToBaseFactor,
        trackInventory: sku.trackInventory,
        quantityMode: sku.quantityMode,
        baseUnitCode: baseUnit.code,
        saleUnitCode: saleUnit.code,
        onHandBaseQty: inventoryBalance.onHandBaseQty,
        reservedBaseQty: inventoryBalance.reservedBaseQty,
        holdBaseQty: inventoryBalance.holdBaseQty,
      })
      .from(sku)
      .innerJoin(product, eq(product.id, sku.productId))
      .leftJoin(inventoryBalance, and(eq(inventoryBalance.skuId, sku.id), eq(inventoryBalance.outletId, outletId)))
      .leftJoin(baseUnit, eq(baseUnit.id, sku.baseUnitId))
      .leftJoin(saleUnit, eq(saleUnit.id, sku.saleUnitId))
      .where(and(eq(sku.organizationId, organizationId), eq(product.outletId, outletId), eq(sku.isActive, true), eq(product.isActive, true)));
  },

  async pullChanges(organizationId: string, outletId: string, sinceDate: Date) {
    const products = await db
      .select()
      .from(product)
      .where(and(eq(product.organizationId, organizationId), eq(product.outletId, outletId), gt(product.updatedAt, sinceDate)));
    const skus = await db
      .select({
        id: sku.id,
        organizationId: sku.organizationId,
        productId: sku.productId,
        globalSkuId: sku.globalSkuId,
        sku: sku.sku,
        barcode: sku.barcode,
        name: sku.name,
        imageUrl: sku.imageUrl,
        baseUnitId: sku.baseUnitId,
        saleUnitId: sku.saleUnitId,
        saleUnitToBaseFactor: sku.saleUnitToBaseFactor,
        price: sku.price,
        cost: sku.cost,
        minStockBaseQty: sku.minStockBaseQty,
        trackInventory: sku.trackInventory,
        quantityMode: sku.quantityMode,
        isActive: sku.isActive,
        createdAt: sku.createdAt,
        updatedAt: sku.updatedAt,
      })
      .from(sku)
      .innerJoin(product, eq(product.id, sku.productId))
      .where(and(eq(sku.organizationId, organizationId), eq(product.outletId, outletId), gt(sku.updatedAt, sinceDate)));
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
