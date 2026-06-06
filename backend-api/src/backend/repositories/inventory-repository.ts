import { and, desc, eq, getTableColumns, gte, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryBalance, inventoryBatch, outlet, product, sku, stockMovement, stockOpname, stockOpnameItem, unit } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { decimal, fixed } from "@/lib/number";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function makeStockOpnameCode() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `SO-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export const inventoryRepository = {
  transaction<T>(callback: (tx: Tx) => Promise<T>) {
    return db.transaction(callback);
  },

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
        batchId: stockMovement.batchId,
        lotCode: inventoryBatch.lotCode,
        expiryDate: inventoryBatch.expiryDate,
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
      .leftJoin(inventoryBatch, eq(inventoryBatch.id, stockMovement.batchId))
      .where(and(...conditions))
      .orderBy(desc(stockMovement.createdAt))
      .limit(500);
  },

  findBatches(organizationId: string, outletId: string, skuId?: string | null) {
    const conditions = [
      eq(inventoryBatch.organizationId, organizationId),
      eq(inventoryBatch.outletId, outletId),
    ];
    if (skuId) conditions.push(eq(inventoryBatch.skuId, skuId));

    return db
      .select({
        id: inventoryBatch.id,
        outletId: inventoryBatch.outletId,
        skuId: inventoryBatch.skuId,
        skuCode: sku.sku,
        skuName: sku.name,
        lotCode: inventoryBatch.lotCode,
        expiryDate: inventoryBatch.expiryDate,
        receivedAt: inventoryBatch.receivedAt,
        initialBaseQty: inventoryBatch.initialBaseQty,
        onHandBaseQty: inventoryBatch.onHandBaseQty,
        unitCost: inventoryBatch.unitCost,
        unitCode: unit.code,
        sourceType: inventoryBatch.sourceType,
        sourceId: inventoryBatch.sourceId,
        sourceItemId: inventoryBatch.sourceItemId,
        note: inventoryBatch.note,
      })
      .from(inventoryBatch)
      .innerJoin(sku, eq(sku.id, inventoryBatch.skuId))
      .innerJoin(unit, eq(unit.id, sku.baseUnitId))
      .where(and(...conditions))
      .orderBy(sql`${inventoryBatch.expiryDate} asc nulls last`, sku.sku, inventoryBatch.receivedAt)
      .limit(500);
  },

  findBatchGaps(organizationId: string, outletId: string) {
    const batchTotal = sql`coalesce((
      select sum(${inventoryBatch.onHandBaseQty})
      from ${inventoryBatch}
      where ${inventoryBatch.organizationId} = ${organizationId}
        and ${inventoryBatch.outletId} = ${inventoryBalance.outletId}
        and ${inventoryBatch.skuId} = ${inventoryBalance.skuId}
    ), 0)`;
    const batchTotalText = sql<string>`(${batchTotal})::text`;
    const gapQty = sql<string>`(${inventoryBalance.onHandBaseQty} - ${batchTotal})::text`;

    return db
      .select({
        outletId: inventoryBalance.outletId,
        skuId: inventoryBalance.skuId,
        skuCode: sku.sku,
        skuName: sku.name,
        onHandBaseQty: inventoryBalance.onHandBaseQty,
        batchOnHandBaseQty: batchTotalText,
        gapBaseQty: gapQty,
        unitId: sku.baseUnitId,
        unitCode: unit.code,
        cost: sku.cost,
      })
      .from(inventoryBalance)
      .innerJoin(sku, eq(sku.id, inventoryBalance.skuId))
      .innerJoin(product, eq(product.id, sku.productId))
      .innerJoin(unit, eq(unit.id, sku.baseUnitId))
      .where(and(
        eq(inventoryBalance.outletId, outletId),
        eq(sku.organizationId, organizationId),
        eq(product.organizationId, organizationId),
        sql`${inventoryBalance.onHandBaseQty} > ${batchTotal}`,
      ))
      .orderBy(sku.sku);
  },

  reconcileBatchGap(input: {
    organizationId: string;
    outletId: string;
    skuId: string;
    actorUserId: string;
  }) {
    return db.transaction(async (tx) => {
      const [gap] = await tx
        .select({
          outletId: inventoryBalance.outletId,
          skuId: inventoryBalance.skuId,
          skuCode: sku.sku,
          skuName: sku.name,
          onHandBaseQty: inventoryBalance.onHandBaseQty,
          batchOnHandBaseQty: sql<string>`coalesce(sum(${inventoryBatch.onHandBaseQty}), 0)::text`,
          unitCost: sku.cost,
        })
        .from(inventoryBalance)
        .innerJoin(sku, eq(sku.id, inventoryBalance.skuId))
        .innerJoin(product, eq(product.id, sku.productId))
        .leftJoin(inventoryBatch, and(
          eq(inventoryBatch.organizationId, input.organizationId),
          eq(inventoryBatch.outletId, inventoryBalance.outletId),
          eq(inventoryBatch.skuId, inventoryBalance.skuId),
        ))
        .where(and(
          eq(inventoryBalance.outletId, input.outletId),
          eq(inventoryBalance.skuId, input.skuId),
          eq(sku.organizationId, input.organizationId),
          eq(product.organizationId, input.organizationId),
        ))
        .groupBy(inventoryBalance.outletId, inventoryBalance.skuId, inventoryBalance.onHandBaseQty, sku.id)
        .limit(1);

      if (!gap) return null;
      const gapQty = decimal(gap.onHandBaseQty) - decimal(gap.batchOnHandBaseQty);
      if (gapQty <= 0.0005) {
        return { error: "NO_GAP" as const, gap };
      }

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const [batch] = await tx
        .insert(inventoryBatch)
        .values({
          organizationId: input.organizationId,
          outletId: input.outletId,
          skuId: input.skuId,
          lotCode: `NON-LOT-${today}`,
          initialBaseQty: fixed(gapQty, 3),
          onHandBaseQty: fixed(gapQty, 3),
          unitCost: gap.unitCost,
          sourceType: "batch_reconciliation",
          sourceId: input.actorUserId,
          note: "Rekonsiliasi batch dari selisih inventory balance",
        })
        .returning();

      return { batch, gapBaseQty: fixed(gapQty, 3), skuCode: gap.skuCode, skuName: gap.skuName };
    });
  },

  listStockOpnames(organizationId: string, outletId: string) {
    return db
      .select({
        id: stockOpname.id,
        outletId: stockOpname.outletId,
        code: stockOpname.code,
        status: stockOpname.status,
        note: stockOpname.note,
        createdAt: stockOpname.createdAt,
        submittedAt: stockOpname.submittedAt,
        approvedAt: stockOpname.approvedAt,
        postedAt: stockOpname.postedAt,
        itemCount: sql<number>`count(${stockOpnameItem.id})::int`,
        countedCount: sql<number>`count(${stockOpnameItem.physicalBaseQty})::int`,
        differenceCount: sql<number>`sum(case when abs(coalesce(${stockOpnameItem.differenceBaseQty}, 0)) >= 0.0005 then 1 else 0 end)::int`,
      })
      .from(stockOpname)
      .leftJoin(stockOpnameItem, eq(stockOpnameItem.stockOpnameId, stockOpname.id))
      .where(and(eq(stockOpname.organizationId, organizationId), eq(stockOpname.outletId, outletId)))
      .groupBy(
        stockOpname.id,
        stockOpname.outletId,
        stockOpname.code,
        stockOpname.status,
        stockOpname.note,
        stockOpname.createdAt,
        stockOpname.submittedAt,
        stockOpname.approvedAt,
        stockOpname.postedAt,
      )
      .orderBy(desc(stockOpname.createdAt))
      .limit(50);
  },

  findStockOpname(id: string, organizationId: string) {
    return db
      .select()
      .from(stockOpname)
      .where(and(eq(stockOpname.id, id), eq(stockOpname.organizationId, organizationId)))
      .limit(1);
  },

  findStockOpnameDetail(id: string, organizationId: string) {
    return db.transaction(async (tx) => {
      const [opname] = await tx
        .select({
          id: stockOpname.id,
          organizationId: stockOpname.organizationId,
          outletId: stockOpname.outletId,
          outletName: outlet.name,
          outletCode: outlet.code,
          code: stockOpname.code,
          status: stockOpname.status,
          note: stockOpname.note,
          createdByUserId: stockOpname.createdByUserId,
          submittedByUserId: stockOpname.submittedByUserId,
          approvedByUserId: stockOpname.approvedByUserId,
          postedByUserId: stockOpname.postedByUserId,
          createdAt: stockOpname.createdAt,
          submittedAt: stockOpname.submittedAt,
          approvedAt: stockOpname.approvedAt,
          postedAt: stockOpname.postedAt,
        })
        .from(stockOpname)
        .innerJoin(outlet, eq(outlet.id, stockOpname.outletId))
        .where(and(eq(stockOpname.id, id), eq(stockOpname.organizationId, organizationId)))
        .limit(1);
      if (!opname) return null;

      const items = await tx
        .select({
          id: stockOpnameItem.id,
          stockOpnameId: stockOpnameItem.stockOpnameId,
          skuId: stockOpnameItem.skuId,
          skuCode: sku.sku,
          skuName: stockOpnameItem.nameSnapshot,
          unitId: stockOpnameItem.unitId,
          unitCode: unit.code,
          systemBaseQty: stockOpnameItem.systemBaseQty,
          physicalBaseQty: stockOpnameItem.physicalBaseQty,
          differenceBaseQty: stockOpnameItem.differenceBaseQty,
          note: stockOpnameItem.note,
        })
        .from(stockOpnameItem)
        .innerJoin(sku, eq(sku.id, stockOpnameItem.skuId))
        .innerJoin(unit, eq(unit.id, stockOpnameItem.unitId))
        .where(eq(stockOpnameItem.stockOpnameId, id))
        .orderBy(sku.sku);

      return { opname, items };
    });
  },

  createStockOpname(input: {
    organizationId: string;
    outletId: string;
    note?: string;
    actorUserId: string;
  }) {
    return db.transaction(async (tx) => {
      const [targetOutlet] = await tx
        .select()
        .from(outlet)
        .where(and(eq(outlet.id, input.outletId), eq(outlet.organizationId, input.organizationId), eq(outlet.isActive, true)))
        .limit(1);
      if (!targetOutlet) return null;

      const snapshotItems = await tx
        .select({
          skuId: sku.id,
          skuCode: sku.sku,
          skuName: sku.name,
          unitId: sku.baseUnitId,
          systemBaseQty: sql<string>`coalesce(${inventoryBalance.onHandBaseQty}, 0)::text`,
        })
        .from(sku)
        .leftJoin(inventoryBalance, and(eq(inventoryBalance.outletId, input.outletId), eq(inventoryBalance.skuId, sku.id)))
        .where(and(eq(sku.organizationId, input.organizationId), eq(sku.isActive, true)))
        .orderBy(sku.sku);
      if (!snapshotItems.length) {
        return { error: "EMPTY_CATALOG" as const };
      }

      const [created] = await tx
        .insert(stockOpname)
        .values({
          organizationId: input.organizationId,
          outletId: input.outletId,
          code: makeStockOpnameCode(),
          status: "draft",
          note: input.note,
          createdByUserId: input.actorUserId,
        })
        .returning();

      await tx.insert(stockOpnameItem).values(
        snapshotItems.map((item) => ({
          stockOpnameId: created.id,
          skuId: item.skuId,
          nameSnapshot: item.skuName,
          unitId: item.unitId,
          systemBaseQty: fixed(decimal(item.systemBaseQty), 3),
        })),
      );

      return created;
    });
  },

  updateStockOpnameCounts(input: {
    organizationId: string;
    stockOpnameId: string;
    items: Array<{ itemId: string; physicalBaseQty: number; note?: string }>;
  }) {
    return db.transaction(async (tx) => {
      const [opname] = await tx
        .select()
        .from(stockOpname)
        .where(and(eq(stockOpname.id, input.stockOpnameId), eq(stockOpname.organizationId, input.organizationId)))
        .limit(1);
      if (!opname) return null;
      if (!["draft", "counted"].includes(opname.status)) {
        return { error: "LOCKED_STATUS" as const, opname };
      }

      for (const item of input.items) {
        await tx
          .update(stockOpnameItem)
          .set({
            physicalBaseQty: fixed(item.physicalBaseQty, 3),
            differenceBaseQty: sql`${fixed(item.physicalBaseQty, 3)}::numeric - ${stockOpnameItem.systemBaseQty}`,
            note: item.note,
            updatedAt: new Date(),
          })
          .where(and(eq(stockOpnameItem.id, item.itemId), eq(stockOpnameItem.stockOpnameId, input.stockOpnameId)));
      }

      return opname;
    });
  },

  submitStockOpname(input: { organizationId: string; stockOpnameId: string; actorUserId: string; note?: string }) {
    return db.transaction(async (tx) => {
      const [opname] = await tx
        .select()
        .from(stockOpname)
        .where(and(eq(stockOpname.id, input.stockOpnameId), eq(stockOpname.organizationId, input.organizationId)))
        .limit(1);
      if (!opname) return null;
      if (!["draft", "counted"].includes(opname.status)) {
        return { error: "LOCKED_STATUS" as const, opname };
      }
      const [uncounted] = await tx
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(stockOpnameItem)
        .where(and(eq(stockOpnameItem.stockOpnameId, input.stockOpnameId), sql`${stockOpnameItem.physicalBaseQty} is null`));
      if ((uncounted?.count ?? 0) > 0) {
        return { error: "UNCOUNTED_ITEMS" as const, uncounted: uncounted?.count ?? 0 };
      }

      const [updated] = await tx
        .update(stockOpname)
        .set({
          status: "counted",
          submittedByUserId: input.actorUserId,
          submittedAt: new Date(),
          note: input.note ?? opname.note,
          updatedAt: new Date(),
        })
        .where(eq(stockOpname.id, input.stockOpnameId))
        .returning();
      return updated;
    });
  },

  approveStockOpname(input: { organizationId: string; stockOpnameId: string; actorUserId: string; note?: string }) {
    return db.transaction(async (tx) => {
      const [opname] = await tx
        .select()
        .from(stockOpname)
        .where(and(eq(stockOpname.id, input.stockOpnameId), eq(stockOpname.organizationId, input.organizationId)))
        .limit(1);
      if (!opname) return null;
      if (opname.status !== "counted") {
        return { error: "INVALID_STATUS" as const, opname };
      }

      const [updated] = await tx
        .update(stockOpname)
        .set({
          status: "approved",
          approvedByUserId: input.actorUserId,
          approvedAt: new Date(),
          note: input.note ?? opname.note,
          updatedAt: new Date(),
        })
        .where(eq(stockOpname.id, input.stockOpnameId))
        .returning();
      return updated;
    });
  },

  postStockOpname(input: { organizationId: string; stockOpnameId: string; actorUserId: string; note?: string }) {
    return db.transaction(async (tx) => {
      const [opname] = await tx
        .select()
        .from(stockOpname)
        .where(and(eq(stockOpname.id, input.stockOpnameId), eq(stockOpname.organizationId, input.organizationId)))
        .limit(1);
      if (!opname) return null;
      if (opname.status !== "approved") {
        return { error: "INVALID_STATUS" as const, opname };
      }

      const items = await tx
        .select()
        .from(stockOpnameItem)
        .where(eq(stockOpnameItem.stockOpnameId, input.stockOpnameId));
      const movements = [];
      for (const item of items) {
        const difference = decimal(item.differenceBaseQty ?? "0");
        if (Math.abs(difference) < 0.0005) continue;

        await tx
          .insert(inventoryBalance)
          .values({
            outletId: opname.outletId,
            skuId: item.skuId,
            onHandBaseQty: fixed(difference, 3),
          })
          .onConflictDoUpdate({
            target: [inventoryBalance.outletId, inventoryBalance.skuId],
            set: {
              onHandBaseQty: sql`${inventoryBalance.onHandBaseQty} + ${fixed(difference, 3)}`,
              updatedAt: new Date(),
            },
          });

        const [movement] = await tx
          .insert(stockMovement)
          .values({
            organizationId: input.organizationId,
            outletId: opname.outletId,
            skuId: item.skuId,
            type: "adjustment",
            quantityBase: fixed(difference, 3),
            unitId: item.unitId,
            quantityInput: fixed(difference, 3),
            referenceType: "stock_opname",
            referenceId: opname.id,
            note: input.note ?? `Posting stock opname ${opname.code}`,
            actorUserId: input.actorUserId,
          })
          .returning();
        movements.push(movement);
      }

      const [updated] = await tx
        .update(stockOpname)
        .set({
          status: "posted",
          postedByUserId: input.actorUserId,
          postedAt: new Date(),
          note: input.note ?? opname.note,
          updatedAt: new Date(),
        })
        .where(eq(stockOpname.id, input.stockOpnameId))
        .returning();
      return { opname: updated, movements };
    });
  },

  adjustStock(input: {
    organizationId: string;
    outletId: string;
    skuId: string;
    type: typeof stockMovement.$inferInsert.type;
    quantityBase: number;
    lotCode?: string;
    expiryDate?: Date;
    note?: string;
    actorUserId: string;
  }) {
    return db.transaction(async (tx) => {
      const [targetSku] = await tx
        .select({ ...getTableColumns(sku) })
        .from(sku)
        .innerJoin(product, eq(product.id, sku.productId))
        .where(and(
          eq(sku.id, input.skuId),
          eq(sku.organizationId, input.organizationId),
          eq(sku.isActive, true),
          eq(product.organizationId, input.organizationId),
          eq(product.outletId, input.outletId),
          eq(product.isActive, true),
        ))
        .limit(1);

      if (!targetSku) {
        return null;
      }

      if (input.quantityBase < 0) {
        const deductedQuantity = Math.abs(input.quantityBase);
        const decremented = await tx
          .update(inventoryBalance)
          .set({
            onHandBaseQty: sql`${inventoryBalance.onHandBaseQty} - ${fixed(deductedQuantity, 3)}`,
            updatedAt: new Date(),
          })
          .where(and(
            eq(inventoryBalance.outletId, input.outletId),
            eq(inventoryBalance.skuId, input.skuId),
            sql`${inventoryBalance.onHandBaseQty} - ${inventoryBalance.reservedBaseQty} - ${inventoryBalance.holdBaseQty} >= ${fixed(deductedQuantity, 3)}`,
          ))
          .returning({ skuId: inventoryBalance.skuId });

        if (!decremented.length) {
          return { error: "INSUFFICIENT_STOCK" as const };
        }
      } else {
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
      }

      let batchId: string | undefined;
      if (input.quantityBase > 0 && (input.lotCode || input.expiryDate)) {
        const lotCode = input.lotCode?.trim() || `NON-LOT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
        const [batch] = await tx
          .insert(inventoryBatch)
          .values({
            organizationId: input.organizationId,
            outletId: input.outletId,
            skuId: input.skuId,
            lotCode,
            expiryDate: input.expiryDate,
            initialBaseQty: fixed(input.quantityBase, 3),
            onHandBaseQty: fixed(input.quantityBase, 3),
            unitCost: targetSku.cost,
            sourceType: "dashboard_inventory_adjustment",
            note: input.note,
          })
          .returning({ id: inventoryBatch.id });
        batchId = batch.id;
      } else if (input.quantityBase < 0) {
        let remaining = Math.abs(input.quantityBase);
        const batches = await tx
          .select({
            id: inventoryBatch.id,
            onHandBaseQty: inventoryBatch.onHandBaseQty,
          })
          .from(inventoryBatch)
          .where(and(
            eq(inventoryBatch.organizationId, input.organizationId),
            eq(inventoryBatch.outletId, input.outletId),
            eq(inventoryBatch.skuId, input.skuId),
            sql`${inventoryBatch.onHandBaseQty} > 0`,
          ))
          .orderBy(sql`${inventoryBatch.expiryDate} asc nulls last`, inventoryBatch.receivedAt);
        for (const batch of batches) {
          if (remaining <= 0) break;
          const batchQty = decimal(batch.onHandBaseQty);
          const deducted = Math.min(batchQty, remaining);
          if (deducted <= 0) continue;
          await tx
            .update(inventoryBatch)
            .set({
              onHandBaseQty: sql`${inventoryBatch.onHandBaseQty} - ${fixed(deducted, 3)}`,
              updatedAt: new Date(),
            })
            .where(eq(inventoryBatch.id, batch.id));
          remaining -= deducted;
        }
        if (remaining > 0.000001) {
          throw new ApiError("BAD_REQUEST", "Batch stok tidak mencukupi", 400);
        }
      }

      const [movement] = await tx
        .insert(stockMovement)
        .values({
          organizationId: input.organizationId,
          outletId: input.outletId,
          skuId: input.skuId,
          batchId,
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

  transferStock(input: {
    organizationId: string;
    fromOutletId: string;
    toOutletId: string;
    skuId: string;
    targetSkuId?: string | null;
    cloneToOutlet?: boolean;
    quantityBase: number;
    note?: string;
    actorUserId: string;
    referenceId: string;
  }) {
    return db.transaction(async (tx) => {
      const [fromOutlet] = await tx
        .select()
        .from(outlet)
        .where(and(eq(outlet.id, input.fromOutletId), eq(outlet.organizationId, input.organizationId), eq(outlet.isActive, true)))
        .limit(1);
      const [toOutlet] = await tx
        .select()
        .from(outlet)
        .where(and(eq(outlet.id, input.toOutletId), eq(outlet.organizationId, input.organizationId), eq(outlet.isActive, true)))
        .limit(1);
      const [sourceRow] = await tx
        .select({
          sku,
          product,
        })
        .from(sku)
        .innerJoin(product, eq(product.id, sku.productId))
        .where(and(
          eq(sku.id, input.skuId),
          eq(sku.organizationId, input.organizationId),
          eq(sku.isActive, true),
          eq(product.organizationId, input.organizationId),
          eq(product.outletId, input.fromOutletId),
          eq(product.isActive, true),
        ))
        .limit(1);

      if (!fromOutlet || !toOutlet || !sourceRow) {
        return null;
      }

      const sourceSku = sourceRow.sku;
      const sourceProduct = sourceRow.product;
      const sourceGlobalProductId = sourceProduct.globalProductId ?? sourceProduct.id;
      const sourceGlobalSkuId = sourceSku.globalSkuId ?? sourceSku.id;
      let targetSku = null as typeof sku.$inferSelect | null;
      let clonedTarget = false;

      if (input.targetSkuId) {
        const [targetRow] = await tx
          .select({ sku, product })
          .from(sku)
          .innerJoin(product, eq(product.id, sku.productId))
          .where(and(
            eq(sku.id, input.targetSkuId),
            eq(sku.organizationId, input.organizationId),
            eq(sku.isActive, true),
            eq(product.organizationId, input.organizationId),
            eq(product.outletId, input.toOutletId),
            eq(product.isActive, true),
          ))
          .limit(1);
        targetSku = targetRow?.sku ?? null;
        if (!targetSku) return null;
        const targetGlobalProductId = targetRow.product.globalProductId ?? targetRow.product.id;
        const targetGlobalSkuId = targetSku.globalSkuId ?? targetSku.id;
        if (targetGlobalProductId !== sourceGlobalProductId || targetGlobalSkuId !== sourceGlobalSkuId) {
          return { error: "TARGET_SKU_MISMATCH" as const };
        }
      } else {
        const [matchedTarget] = await tx
          .select({ sku, product })
          .from(sku)
          .innerJoin(product, eq(product.id, sku.productId))
          .where(and(
            eq(product.organizationId, input.organizationId),
            eq(product.outletId, input.toOutletId),
            eq(sku.isActive, true),
            eq(product.isActive, true),
            or(
              and(eq(product.globalProductId, sourceGlobalProductId), eq(sku.globalSkuId, sourceGlobalSkuId)),
              and(
                eq(product.name, sourceProduct.name),
                eq(sku.sku, sourceSku.sku),
                eq(sku.name, sourceSku.name),
                eq(sku.baseUnitId, sourceSku.baseUnitId),
                eq(sku.saleUnitId, sourceSku.saleUnitId),
              ),
            ),
          ))
          .limit(1);
        targetSku = matchedTarget?.sku ?? null;
        if (matchedTarget) {
          if (matchedTarget.product.globalProductId !== sourceGlobalProductId) {
            await tx
              .update(product)
              .set({ globalProductId: sourceGlobalProductId, updatedAt: new Date() })
              .where(eq(product.id, matchedTarget.product.id));
          }
          if (matchedTarget.sku.globalSkuId !== sourceGlobalSkuId) {
            const [linkedSku] = await tx
              .update(sku)
              .set({ globalSkuId: sourceGlobalSkuId, updatedAt: new Date() })
              .where(eq(sku.id, matchedTarget.sku.id))
              .returning();
            targetSku = linkedSku;
          }
        }

        if (!targetSku) {
          const [createdProduct] = await tx
            .insert(product)
            .values({
              organizationId: input.organizationId,
              outletId: input.toOutletId,
              globalProductId: sourceGlobalProductId,
              name: sourceProduct.name,
              category: sourceProduct.category,
              imageUrl: sourceProduct.imageUrl,
              voidWindowHours: sourceProduct.voidWindowHours,
              refundWindowHours: sourceProduct.refundWindowHours,
              isActive: sourceProduct.isActive,
            })
            .returning();
          const [createdSku] = await tx
            .insert(sku)
            .values({
              organizationId: input.organizationId,
              productId: createdProduct.id,
              globalSkuId: sourceGlobalSkuId,
              sku: sourceSku.sku,
              barcode: sourceSku.barcode,
              name: sourceSku.name,
              imageUrl: sourceSku.imageUrl,
              baseUnitId: sourceSku.baseUnitId,
              saleUnitId: sourceSku.saleUnitId,
              saleUnitToBaseFactor: sourceSku.saleUnitToBaseFactor,
              price: sourceSku.price,
              cost: sourceSku.cost,
              minStockBaseQty: sourceSku.minStockBaseQty,
              isActive: sourceSku.isActive,
            })
            .returning();
          targetSku = createdSku;
          clonedTarget = true;
        }
      }

      const [currentBalance] = await tx
        .select({
          onHandBaseQty: inventoryBalance.onHandBaseQty,
          reservedBaseQty: inventoryBalance.reservedBaseQty,
          holdBaseQty: inventoryBalance.holdBaseQty,
        })
        .from(inventoryBalance)
        .where(and(eq(inventoryBalance.outletId, input.fromOutletId), eq(inventoryBalance.skuId, input.skuId)))
        .limit(1);
      const availableQty =
        decimal(currentBalance?.onHandBaseQty ?? "0") -
        decimal(currentBalance?.reservedBaseQty ?? "0") -
        decimal(currentBalance?.holdBaseQty ?? "0");
      if (availableQty < input.quantityBase) {
        return { error: "INSUFFICIENT_STOCK" as const };
      }

      const decremented = await tx
        .update(inventoryBalance)
        .set({
          onHandBaseQty: sql`${inventoryBalance.onHandBaseQty} - ${fixed(input.quantityBase, 3)}`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(inventoryBalance.outletId, input.fromOutletId),
          eq(inventoryBalance.skuId, input.skuId),
          sql`${inventoryBalance.onHandBaseQty} - ${inventoryBalance.reservedBaseQty} - ${inventoryBalance.holdBaseQty} >= ${fixed(input.quantityBase, 3)}`,
        ))
        .returning({ skuId: inventoryBalance.skuId });
      if (!decremented.length) {
        return { error: "INSUFFICIENT_STOCK" as const };
      }

      let remainingBatchQty = input.quantityBase;
      const batchAllocations: Array<{ sourceBatchId: string | null; targetBatchId: string; quantityBase: number }> = [];
      const sourceBatches = await tx
        .select({
          id: inventoryBatch.id,
          lotCode: inventoryBatch.lotCode,
          expiryDate: inventoryBatch.expiryDate,
          onHandBaseQty: inventoryBatch.onHandBaseQty,
          unitCost: inventoryBatch.unitCost,
        })
        .from(inventoryBatch)
        .where(and(
          eq(inventoryBatch.organizationId, input.organizationId),
          eq(inventoryBatch.outletId, input.fromOutletId),
          eq(inventoryBatch.skuId, input.skuId),
          sql`${inventoryBatch.onHandBaseQty} > 0`,
        ))
        .orderBy(sql`${inventoryBatch.expiryDate} asc nulls last`, inventoryBatch.receivedAt);

      for (const batch of sourceBatches) {
        if (remainingBatchQty <= 0.000001) break;
        const batchQty = decimal(batch.onHandBaseQty);
        const deducted = Math.min(batchQty, remainingBatchQty);
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
          throw new ApiError("BAD_REQUEST", "Stok outlet asal tidak mencukupi", 400);
        }

        const [targetBatch] = await tx
          .insert(inventoryBatch)
          .values({
            organizationId: input.organizationId,
            outletId: input.toOutletId,
            skuId: targetSku.id,
            lotCode: batch.lotCode,
            expiryDate: batch.expiryDate,
            initialBaseQty: fixed(deducted, 3),
            onHandBaseQty: fixed(deducted, 3),
            unitCost: batch.unitCost,
            sourceType: "inventory_transfer",
            sourceId: input.referenceId,
            sourceItemId: batch.id,
            note: input.note,
          })
          .returning({ id: inventoryBatch.id });
        batchAllocations.push({ sourceBatchId: batch.id, targetBatchId: targetBatch.id, quantityBase: deducted });
        remainingBatchQty -= deducted;
      }

      if (remainingBatchQty > 0.000001) {
        throw new ApiError("BAD_REQUEST", "Batch stok outlet asal tidak mencukupi. Reconcile batch gap sebelum transfer.", 400);
      }

      await tx
        .insert(inventoryBalance)
        .values({
          outletId: input.toOutletId,
          skuId: targetSku.id,
          onHandBaseQty: fixed(input.quantityBase, 3),
        })
        .onConflictDoUpdate({
          target: [inventoryBalance.outletId, inventoryBalance.skuId],
          set: {
            onHandBaseQty: sql`${inventoryBalance.onHandBaseQty} + ${fixed(input.quantityBase, 3)}`,
            updatedAt: new Date(),
          },
        });

      const movementValues = batchAllocations.flatMap((allocation) => [
        {
          organizationId: input.organizationId,
          outletId: input.fromOutletId,
          skuId: input.skuId,
          batchId: allocation.sourceBatchId ?? undefined,
          type: "transfer_out" as const,
          quantityBase: fixed(-allocation.quantityBase, 3),
          quantityInput: fixed(allocation.quantityBase, 3),
          unitId: sourceSku.baseUnitId,
          referenceType: "inventory_transfer",
          referenceId: input.referenceId,
          note: input.note ?? `Transfer ke ${toOutlet.name}`,
          actorUserId: input.actorUserId,
        },
        {
          organizationId: input.organizationId,
          outletId: input.toOutletId,
          skuId: targetSku.id,
          batchId: allocation.targetBatchId,
          type: "transfer_in" as const,
          quantityBase: fixed(allocation.quantityBase, 3),
          quantityInput: fixed(allocation.quantityBase, 3),
          unitId: targetSku.baseUnitId,
          referenceType: "inventory_transfer",
          referenceId: input.referenceId,
          note: input.note ?? `Transfer dari ${fromOutlet.name}`,
          actorUserId: input.actorUserId,
        },
      ]);
      const movements = await tx.insert(stockMovement).values(movementValues).returning();
      return { movements, fromOutlet, toOutlet, sourceSku, targetSku, clonedTarget };
    });
  },
};
