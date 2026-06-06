import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  inventoryBalance,
  inventoryBatch,
  outlet,
  product,
  sku,
  stockMovement,
  unit,
  wasteAdjustment,
} from "@/db/schema";
import { fixed } from "@/lib/number";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const wasteRepository = {
  transaction<T>(callback: (tx: Tx) => Promise<T>) {
    return db.transaction(callback);
  },

  findActiveOutlet(tx: Tx, outletId: string, organizationId: string) {
    return tx
      .select()
      .from(outlet)
      .where(and(eq(outlet.id, outletId), eq(outlet.organizationId, organizationId), eq(outlet.isActive, true)))
      .limit(1);
  },

  findActiveSku(tx: Tx, skuId: string, organizationId: string, outletId?: string) {
    const conditions = [eq(sku.id, skuId), eq(sku.organizationId, organizationId), eq(sku.isActive, true)];
    if (outletId) conditions.push(eq(product.outletId, outletId), eq(product.isActive, true));
    return tx
      .select({ ...getTableColumns(sku) })
      .from(sku)
      .innerJoin(product, eq(product.id, sku.productId))
      .where(and(...conditions))
      .limit(1);
  },

  findUnit(tx: Tx, unitId: string, organizationId: string) {
    return tx.select().from(unit).where(and(eq(unit.id, unitId), eq(unit.organizationId, organizationId))).limit(1);
  },

  createAdjustment(tx: Tx, values: typeof wasteAdjustment.$inferInsert) {
    return tx.insert(wasteAdjustment).values(values).returning();
  },

  findByIdempotencyKey(tx: Tx, organizationId: string, idempotencyKey: string) {
    return tx
      .select()
      .from(wasteAdjustment)
      .where(and(eq(wasteAdjustment.organizationId, organizationId), eq(wasteAdjustment.idempotencyKey, idempotencyKey)))
      .limit(1);
  },

  findAdjustment(tx: Tx, wasteId: string, organizationId: string) {
    return tx
      .select()
      .from(wasteAdjustment)
      .where(and(eq(wasteAdjustment.id, wasteId), eq(wasteAdjustment.organizationId, organizationId)))
      .limit(1);
  },

  updateApproval(tx: Tx, wasteId: string, values: Partial<typeof wasteAdjustment.$inferInsert>) {
    return tx.update(wasteAdjustment).set(values).where(eq(wasteAdjustment.id, wasteId)).returning();
  },

  decrementBalance(tx: Tx, outletId: string, skuId: string, quantityBase: number) {
    return tx
      .update(inventoryBalance)
      .set({
        onHandBaseQty: sql`${inventoryBalance.onHandBaseQty} - ${fixed(quantityBase, 3)}`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(inventoryBalance.outletId, outletId),
        eq(inventoryBalance.skuId, skuId),
        sql`${inventoryBalance.onHandBaseQty} - ${inventoryBalance.reservedBaseQty} - ${inventoryBalance.holdBaseQty} >= ${fixed(quantityBase, 3)}`,
      ))
      .returning({ skuId: inventoryBalance.skuId });
  },

  async decrementBatchesFefo(tx: Tx, organizationId: string, outletId: string, skuId: string, quantityBase: number) {
    let remaining = quantityBase;
    const allocations: Array<{ batchId: string | null; quantityBase: number }> = [];
    const batches = await tx
      .select({
        id: inventoryBatch.id,
        onHandBaseQty: inventoryBatch.onHandBaseQty,
      })
      .from(inventoryBatch)
      .where(and(
        eq(inventoryBatch.organizationId, organizationId),
        eq(inventoryBatch.outletId, outletId),
        eq(inventoryBatch.skuId, skuId),
        sql`${inventoryBatch.onHandBaseQty} > 0`,
      ))
      .orderBy(sql`${inventoryBatch.expiryDate} asc nulls last`, inventoryBatch.receivedAt);

    for (const batch of batches) {
      if (remaining <= 0.000001) break;
      const batchQty = Number(batch.onHandBaseQty ?? 0);
      const deducted = Math.min(batchQty, remaining);
      if (deducted <= 0) continue;
      const updated = await tx
        .update(inventoryBatch)
        .set({
          onHandBaseQty: sql`${inventoryBatch.onHandBaseQty} - ${fixed(deducted, 3)}`,
          updatedAt: new Date(),
        })
        .where(and(eq(inventoryBatch.id, batch.id), sql`${inventoryBatch.onHandBaseQty} >= ${fixed(deducted, 3)}`))
        .returning({ id: inventoryBatch.id });
      if (!updated.length) {
        return null;
      }
      allocations.push({ batchId: batch.id, quantityBase: deducted });
      remaining -= deducted;
    }

    if (remaining > 0.000001) {
      return null;
    }

    return allocations;
  },

  createStockMovement(tx: Tx, values: typeof stockMovement.$inferInsert) {
    return tx.insert(stockMovement).values(values);
  },

  createAuditLog(tx: Tx, values: typeof auditLog.$inferInsert) {
    return tx.insert(auditLog).values(values);
  },

  findManyByOrganization(organizationId: string) {
    return db
      .select()
      .from(wasteAdjustment)
      .where(eq(wasteAdjustment.organizationId, organizationId))
      .orderBy(desc(wasteAdjustment.createdAt))
      .limit(500);
  },
};

export type WasteTransaction = Tx;
