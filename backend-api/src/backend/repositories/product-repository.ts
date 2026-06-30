import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryBalance, inventoryBatch, product, promotion, purchaseOrderItem, saleItem, sku, stockMovement, stockOpnameItem } from "@/db/schema";
import type { ListQuery } from "@/lib/http";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const productRepository = {
  findManyWithSkus(organizationId: string, outletId: string, options: ListQuery = {}) {
    const search = options.search ? `%${options.search}%` : undefined;

    return db.query.product.findMany({
      where: and(
        eq(product.organizationId, organizationId),
        eq(product.outletId, outletId),
        search ? or(ilike(product.name, search), ilike(product.category, search)) : undefined,
      ),
      orderBy: [asc(product.name), asc(product.id)],
      limit: options.limit,
      offset: options.offset,
      with: {
        skus: {
          orderBy: [asc(sku.name), asc(sku.id)],
          with: {
            baseUnit: true,
            saleUnit: true,
          },
        },
      },
    });
  },

  createWithSku(
    organizationId: string,
    values: Omit<typeof product.$inferInsert, "organizationId" | "outletId">,
    skuValues: Omit<typeof sku.$inferInsert, "organizationId" | "productId">,
    outletId?: string,
  ) {
    return db.transaction(async (tx) => {
      const [createdProduct] = await tx
        .insert(product)
        .values({
          organizationId,
          outletId,
          ...values,
        })
        .returning();
      const [globalLinkedProduct] = await tx
        .update(product)
        .set({ globalProductId: createdProduct.globalProductId ?? createdProduct.id })
        .where(eq(product.id, createdProduct.id))
        .returning();

      const [createdSku] = await tx
        .insert(sku)
        .values({
          organizationId,
          productId: globalLinkedProduct.id,
          ...skuValues,
        })
        .returning();
      const [globalLinkedSku] = await tx
        .update(sku)
        .set({ globalSkuId: createdSku.globalSkuId ?? createdSku.id })
        .where(eq(sku.id, createdSku.id))
        .returning();

      if (outletId && skuValues.trackInventory !== false) {
        await tx
          .insert(inventoryBalance)
          .values({
            outletId,
            skuId: globalLinkedSku.id,
            onHandBaseQty: "0",
          })
          .onConflictDoNothing();
      }

      return { product: globalLinkedProduct, sku: globalLinkedSku };
    });
  },

  findSkuIdsByOutlet(outletId: string) {
    return db.select({ skuId: inventoryBalance.skuId }).from(inventoryBalance).where(eq(inventoryBalance.outletId, outletId));
  },

  findById(tx: Tx, id: string, organizationId: string) {
    return tx
      .select()
      .from(product)
      .where(and(eq(product.id, id), eq(product.organizationId, organizationId)))
      .limit(1);
  },

  updateProduct(tx: Tx, id: string, organizationId: string, values: Partial<typeof product.$inferInsert>) {
    return tx
      .update(product)
      .set(values)
      .where(and(eq(product.id, id), eq(product.organizationId, organizationId)))
      .returning();
  },

  findSku(tx: Tx, id: string, productId: string, organizationId: string) {
    return tx
      .select()
      .from(sku)
      .where(and(eq(sku.id, id), eq(sku.productId, productId), eq(sku.organizationId, organizationId)))
      .limit(1);
  },

  async createSku(
    tx: Tx,
    organizationId: string,
    productId: string,
    values: Omit<typeof sku.$inferInsert, "organizationId" | "productId">,
    outletId?: string,
  ) {
    const [createdSku] = await tx
      .insert(sku)
      .values({
        organizationId,
        productId,
        ...values,
      })
      .returning();
    const [globalLinkedSku] = await tx
      .update(sku)
      .set({ globalSkuId: createdSku.globalSkuId ?? createdSku.id })
      .where(eq(sku.id, createdSku.id))
      .returning();

    if (outletId && values.trackInventory !== false) {
      await tx
        .insert(inventoryBalance)
        .values({
          outletId,
          skuId: globalLinkedSku.id,
          onHandBaseQty: "0",
        })
        .onConflictDoNothing();
    }

    return globalLinkedSku;
  },

  updateSku(tx: Tx, id: string, productId: string, organizationId: string, values: Partial<typeof sku.$inferInsert>) {
    return tx
      .update(sku)
      .set(values)
      .where(and(eq(sku.id, id), eq(sku.productId, productId), eq(sku.organizationId, organizationId)))
      .returning();
  },

  async findSkuDeleteUsage(tx: Tx, skuId: string, organizationId: string) {
    const [row] = await tx
      .select({
        saleItems: sql<number>`count(distinct ${saleItem.id})::int`,
        stockMovements: sql<number>`count(distinct ${stockMovement.id})::int`,
        purchaseItems: sql<number>`count(distinct ${purchaseOrderItem.id})::int`,
        opnameItems: sql<number>`count(distinct ${stockOpnameItem.id})::int`,
        batches: sql<number>`count(distinct ${inventoryBatch.id})::int`,
        promotions: sql<number>`count(distinct ${promotion.id})::int`,
        nonZeroBalances: sql<number>`count(distinct ${inventoryBalance.skuId}) filter (where ${inventoryBalance.onHandBaseQty} <> 0 or ${inventoryBalance.reservedBaseQty} <> 0 or ${inventoryBalance.holdBaseQty} <> 0)::int`,
      })
      .from(sku)
      .leftJoin(saleItem, eq(saleItem.skuId, sku.id))
      .leftJoin(stockMovement, eq(stockMovement.skuId, sku.id))
      .leftJoin(purchaseOrderItem, eq(purchaseOrderItem.skuId, sku.id))
      .leftJoin(stockOpnameItem, eq(stockOpnameItem.skuId, sku.id))
      .leftJoin(inventoryBatch, eq(inventoryBatch.skuId, sku.id))
      .leftJoin(promotion, eq(promotion.targetSkuId, sku.id))
      .leftJoin(inventoryBalance, eq(inventoryBalance.skuId, sku.id))
      .where(and(eq(sku.id, skuId), eq(sku.organizationId, organizationId)));

    return row ?? {
      saleItems: 0,
      stockMovements: 0,
      purchaseItems: 0,
      opnameItems: 0,
      batches: 0,
      promotions: 0,
      nonZeroBalances: 0,
    };
  },

  deleteSku(tx: Tx, id: string, productId: string, organizationId: string) {
    return tx
      .delete(sku)
      .where(and(eq(sku.id, id), eq(sku.productId, productId), eq(sku.organizationId, organizationId)))
      .returning();
  },

  transaction<T>(callback: (tx: Tx) => Promise<T>) {
    return db.transaction(callback);
  },
};
