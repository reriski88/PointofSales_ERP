import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { inventoryBalance, inventoryBatch, outlet, sku, stockMovement, stockOpname, stockOpnameItem, unit } from "@/db/schema";
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
        itemCount: sql<number>`(
          select count(*)::int
          from ${stockOpnameItem}
          where ${stockOpnameItem.stockOpnameId} = ${stockOpname.id}
        )`,
        countedCount: sql<number>`(
          select count(*)::int
          from ${stockOpnameItem}
          where ${stockOpnameItem.stockOpnameId} = ${stockOpname.id}
            and ${stockOpnameItem.physicalBaseQty} is not null
        )`,
        differenceCount: sql<number>`(
          select count(*)::int
          from ${stockOpnameItem}
          where ${stockOpnameItem.stockOpnameId} = ${stockOpname.id}
            and coalesce(${stockOpnameItem.differenceBaseQty}, 0) <> 0
        )`,
      })
      .from(stockOpname)
      .where(and(eq(stockOpname.organizationId, organizationId), eq(stockOpname.outletId, outletId)))
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
      const [targetSku] = await tx
        .select()
        .from(sku)
        .where(and(eq(sku.id, input.skuId), eq(sku.organizationId, input.organizationId), eq(sku.isActive, true)))
        .limit(1);

      if (!fromOutlet || !toOutlet || !targetSku) {
        return null;
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

      await tx
        .insert(inventoryBalance)
        .values({
          outletId: input.toOutletId,
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

      const movementValues = [
        {
          organizationId: input.organizationId,
          outletId: input.fromOutletId,
          skuId: input.skuId,
          type: "transfer_out" as const,
          quantityBase: fixed(-input.quantityBase, 3),
          quantityInput: fixed(input.quantityBase, 3),
          unitId: targetSku.baseUnitId,
          referenceType: "inventory_transfer",
          referenceId: input.referenceId,
          note: input.note ?? `Transfer ke ${toOutlet.name}`,
          actorUserId: input.actorUserId,
        },
        {
          organizationId: input.organizationId,
          outletId: input.toOutletId,
          skuId: input.skuId,
          type: "transfer_in" as const,
          quantityBase: fixed(input.quantityBase, 3),
          quantityInput: fixed(input.quantityBase, 3),
          unitId: targetSku.baseUnitId,
          referenceType: "inventory_transfer",
          referenceId: input.referenceId,
          note: input.note ?? `Transfer dari ${fromOutlet.name}`,
          actorUserId: input.actorUserId,
        },
      ];
      const movements = await tx.insert(stockMovement).values(movementValues).returning();
      return { movements, fromOutlet, toOutlet, sku: targetSku };
    });
  },
};
