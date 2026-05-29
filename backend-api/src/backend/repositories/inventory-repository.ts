import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryBalance, sku, stockMovement, unit } from "@/db/schema";
import { fixed } from "@/lib/number";

export const inventoryRepository = {
  findBalances(organizationId: string, outletId: string) {
    return db
      .select({
        outletId: inventoryBalance.outletId,
        skuId: inventoryBalance.skuId,
        skuCode: sku.sku,
        skuName: sku.name,
        onHandBaseQty: inventoryBalance.onHandBaseQty,
        reservedBaseQty: inventoryBalance.reservedBaseQty,
        holdBaseQty: inventoryBalance.holdBaseQty,
        minStockBaseQty: sku.minStockBaseQty,
        minStockUnitCode: unit.code,
      })
      .from(inventoryBalance)
      .innerJoin(sku, eq(sku.id, inventoryBalance.skuId))
      .innerJoin(unit, eq(unit.id, sku.baseUnitId))
      .where(and(eq(inventoryBalance.outletId, outletId), eq(sku.organizationId, organizationId)));
  },

  findMovements(organizationId: string, outletId: string, from?: string | null, to?: string | null) {
    const conditions = [eq(stockMovement.organizationId, organizationId), eq(stockMovement.outletId, outletId)];
    if (from) {
      conditions.push(gte(stockMovement.createdAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(stockMovement.createdAt, new Date(to)));
    }

    return db
      .select({
        id: stockMovement.id,
        type: stockMovement.type,
        skuId: stockMovement.skuId,
        skuCode: sku.sku,
        skuName: sku.name,
        quantityBase: stockMovement.quantityBase,
        quantityInput: stockMovement.quantityInput,
        baseUnitCode: unit.code,
        referenceType: stockMovement.referenceType,
        referenceId: stockMovement.referenceId,
        note: stockMovement.note,
        createdAt: stockMovement.createdAt,
      })
      .from(stockMovement)
      .leftJoin(sku, eq(sku.id, stockMovement.skuId))
      .leftJoin(unit, eq(unit.id, sku.baseUnitId))
      .where(and(...conditions))
      .orderBy(desc(stockMovement.createdAt))
      .limit(500);
  },

  adjustStock(input: {
    organizationId: string;
    outletId: string;
    skuId: string;
    type: typeof stockMovement.$inferInsert.type;
    quantityBase: number;
    note?: string;
    actorUserId: string;
  }) {
    return db.transaction(async (tx) => {
      const [targetSku] = await tx
        .select()
        .from(sku)
        .where(and(eq(sku.id, input.skuId), eq(sku.organizationId, input.organizationId), eq(sku.isActive, true)))
        .limit(1);

      if (!targetSku) {
        return null;
      }

      await tx
        .insert(inventoryBalance)
        .values({
          outletId: input.outletId,
          skuId: input.skuId,
          onHandBaseQty: fixed(input.quantityBase, 3),
        })
        .onConflictDoUpdate({
          target: [inventoryBalance.outletId, inventoryBalance.skuId],
          set: {
            onHandBaseQty: sql`${inventoryBalance.onHandBaseQty} + ${fixed(input.quantityBase, 3)}`,
            updatedAt: new Date(),
          },
        });

      const [movement] = await tx
        .insert(stockMovement)
        .values({
          organizationId: input.organizationId,
          outletId: input.outletId,
          skuId: input.skuId,
          type: input.type,
          quantityBase: fixed(input.quantityBase, 3),
          quantityInput: fixed(input.quantityBase, 3),
          unitId: targetSku.baseUnitId,
          referenceType: "dashboard_inventory_adjustment",
          note: input.note,
          actorUserId: input.actorUserId,
        })
        .returning();

      return movement;
    });
  },
};
