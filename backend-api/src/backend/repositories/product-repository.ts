import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { inventoryBalance, product, sku } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const productRepository = {
  findManyWithSkus(organizationId: string) {
    return db.query.product.findMany({
      where: eq(product.organizationId, organizationId),
      with: {
        skus: {
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
    values: Omit<typeof product.$inferInsert, "organizationId">,
    skuValues: Omit<typeof sku.$inferInsert, "organizationId" | "productId">,
    outletId?: string,
  ) {
    return db.transaction(async (tx) => {
      const [createdProduct] = await tx
        .insert(product)
        .values({
          organizationId,
          ...values,
        })
        .returning();

      const [createdSku] = await tx
        .insert(sku)
        .values({
          organizationId,
          productId: createdProduct.id,
          ...skuValues,
        })
        .returning();

      if (outletId) {
        await tx
          .insert(inventoryBalance)
          .values({
            outletId,
            skuId: createdSku.id,
            onHandBaseQty: "0",
          })
          .onConflictDoNothing();
      }

      return { product: createdProduct, sku: createdSku };
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

  updateSku(tx: Tx, id: string, productId: string, organizationId: string, values: Partial<typeof sku.$inferInsert>) {
    return tx
      .update(sku)
      .set(values)
      .where(and(eq(sku.id, id), eq(sku.productId, productId), eq(sku.organizationId, organizationId)))
      .returning();
  },

  transaction<T>(callback: (tx: Tx) => Promise<T>) {
    return db.transaction(callback);
  },
};
