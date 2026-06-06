import { and, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  inventoryBalance,
  inventoryBatch,
  outlet,
  product,
  purchaseOrder,
  purchaseOrderItem,
  purchasePayment,
  sku,
  stockMovement,
  supplier,
  unit,
} from "@/db/schema";
import { fixed } from "@/lib/number";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const purchaseRepository = {
  transaction<T>(callback: (tx: Tx) => Promise<T>) {
    return db.transaction(callback);
  },

  findSuppliers(organizationId: string) {
    return db
      .select()
      .from(supplier)
      .where(eq(supplier.organizationId, organizationId))
      .orderBy(supplier.name);
  },

  findSupplier(tx: Tx, supplierId: string, organizationId: string) {
    return tx
      .select()
      .from(supplier)
      .where(and(eq(supplier.id, supplierId), eq(supplier.organizationId, organizationId)))
      .limit(1);
  },

  createSupplier(values: typeof supplier.$inferInsert) {
    return db.insert(supplier).values(values).returning();
  },

  updateSupplier(id: string, organizationId: string, values: Partial<typeof supplier.$inferInsert>) {
    return db
      .update(supplier)
      .set(values)
      .where(and(eq(supplier.id, id), eq(supplier.organizationId, organizationId)))
      .returning();
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

  createPurchaseOrder(tx: Tx, values: typeof purchaseOrder.$inferInsert) {
    return tx.insert(purchaseOrder).values(values).returning();
  },

  createPurchaseOrderItem(tx: Tx, values: typeof purchaseOrderItem.$inferInsert) {
    return tx.insert(purchaseOrderItem).values(values).returning();
  },

  findPurchaseOrders(organizationId: string, outletId?: string | null) {
    const conditions = [eq(purchaseOrder.organizationId, organizationId)];
    if (outletId) conditions.push(eq(purchaseOrder.outletId, outletId));

    return db
      .select({
        id: purchaseOrder.id,
        outletId: purchaseOrder.outletId,
        outletName: outlet.name,
        supplierId: purchaseOrder.supplierId,
        supplierName: supplier.name,
        orderNumber: purchaseOrder.orderNumber,
        status: purchaseOrder.status,
        paymentStatus: purchaseOrder.paymentStatus,
        subtotal: purchaseOrder.subtotal,
        paidTotal: purchaseOrder.paidTotal,
        note: purchaseOrder.note,
        receivedAt: purchaseOrder.receivedAt,
        createdAt: purchaseOrder.createdAt,
      })
      .from(purchaseOrder)
      .innerJoin(outlet, eq(outlet.id, purchaseOrder.outletId))
      .innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
      .where(and(...conditions))
      .orderBy(desc(purchaseOrder.createdAt))
      .limit(200);
  },

  findPurchaseOrder(tx: Tx, id: string, organizationId: string) {
    return tx
      .select()
      .from(purchaseOrder)
      .where(and(eq(purchaseOrder.id, id), eq(purchaseOrder.organizationId, organizationId)))
      .limit(1);
  },

  findPurchaseOrderDetail(tx: Tx, id: string, organizationId: string) {
    return tx
      .select({
        id: purchaseOrder.id,
        organizationId: purchaseOrder.organizationId,
        outletId: purchaseOrder.outletId,
        outletName: outlet.name,
        outletCode: outlet.code,
        supplierId: purchaseOrder.supplierId,
        supplierName: supplier.name,
        supplierCode: supplier.code,
        orderNumber: purchaseOrder.orderNumber,
        status: purchaseOrder.status,
        paymentStatus: purchaseOrder.paymentStatus,
        subtotal: purchaseOrder.subtotal,
        paidTotal: purchaseOrder.paidTotal,
        note: purchaseOrder.note,
        receivedAt: purchaseOrder.receivedAt,
        createdAt: purchaseOrder.createdAt,
      })
      .from(purchaseOrder)
      .innerJoin(outlet, eq(outlet.id, purchaseOrder.outletId))
      .innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
      .where(and(eq(purchaseOrder.id, id), eq(purchaseOrder.organizationId, organizationId)))
      .limit(1);
  },

  findPurchaseOrderItems(tx: Tx, purchaseOrderId: string) {
    return tx
      .select({
        id: purchaseOrderItem.id,
        purchaseOrderId: purchaseOrderItem.purchaseOrderId,
        skuId: purchaseOrderItem.skuId,
        skuCode: sku.sku,
        nameSnapshot: purchaseOrderItem.nameSnapshot,
        quantityBase: purchaseOrderItem.quantityBase,
        unitId: purchaseOrderItem.unitId,
        unitCode: unit.code,
        unitCost: purchaseOrderItem.unitCost,
        lineTotal: purchaseOrderItem.lineTotal,
        receivedBaseQty: purchaseOrderItem.receivedBaseQty,
        lotCode: purchaseOrderItem.lotCode,
        expiryDate: purchaseOrderItem.expiryDate,
      })
      .from(purchaseOrderItem)
      .innerJoin(sku, eq(sku.id, purchaseOrderItem.skuId))
      .innerJoin(unit, eq(unit.id, purchaseOrderItem.unitId))
      .where(eq(purchaseOrderItem.purchaseOrderId, purchaseOrderId));
  },

  updatePurchaseOrder(tx: Tx, id: string, values: Partial<typeof purchaseOrder.$inferInsert>) {
    return tx.update(purchaseOrder).set(values).where(eq(purchaseOrder.id, id)).returning();
  },

  updatePurchaseOrderItem(tx: Tx, id: string, values: Partial<typeof purchaseOrderItem.$inferInsert>) {
    return tx.update(purchaseOrderItem).set(values).where(eq(purchaseOrderItem.id, id)).returning();
  },

  incrementBalance(tx: Tx, outletId: string, skuId: string, quantityBase: number) {
    return tx
      .insert(inventoryBalance)
      .values({
        outletId,
        skuId,
        onHandBaseQty: fixed(quantityBase, 3),
      })
      .onConflictDoUpdate({
        target: [inventoryBalance.outletId, inventoryBalance.skuId],
        set: {
          onHandBaseQty: sql`${inventoryBalance.onHandBaseQty} + ${fixed(quantityBase, 3)}`,
          updatedAt: new Date(),
        },
      });
  },

  createInventoryBatch(tx: Tx, values: typeof inventoryBatch.$inferInsert) {
    return tx.insert(inventoryBatch).values(values).returning();
  },

  updateSkuCost(tx: Tx, skuId: string, cost: number) {
    return tx.update(sku).set({ cost: fixed(cost, 6), updatedAt: new Date() }).where(eq(sku.id, skuId));
  },

  createStockMovement(tx: Tx, values: typeof stockMovement.$inferInsert) {
    return tx.insert(stockMovement).values(values);
  },

  createPurchasePayment(tx: Tx, values: typeof purchasePayment.$inferInsert) {
    return tx.insert(purchasePayment).values(values).returning();
  },

  findPurchasePayments(tx: Tx, purchaseOrderId: string) {
    return tx.select().from(purchasePayment).where(eq(purchasePayment.purchaseOrderId, purchaseOrderId));
  },

  createAuditLog(tx: Tx, values: typeof auditLog.$inferInsert) {
    return tx.insert(auditLog).values(values);
  },
};
