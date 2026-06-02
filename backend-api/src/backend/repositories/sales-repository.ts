import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  inventoryBalance,
  outlet,
  payment,
  product,
  sale,
  saleItem,
  shift,
  sku,
  stockMovement,
  unit,
} from "@/db/schema";
import { fixed } from "@/lib/number";
import type { Actor } from "@/lib/rbac";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const salesRepository = {
  transaction<T>(callback: (tx: Tx) => Promise<T>) {
    return db.transaction(callback);
  },

  findByIdempotencyKey(tx: Tx, organizationId: string, idempotencyKey: string) {
    return tx
      .select()
      .from(sale)
      .where(and(eq(sale.organizationId, organizationId), eq(sale.idempotencyKey, idempotencyKey)))
      .limit(1);
  },

  findSaleByIdTx(tx: Tx, id: string, organizationId: string) {
    return tx
      .select()
      .from(sale)
      .where(and(eq(sale.id, id), eq(sale.organizationId, organizationId)))
      .limit(1);
  },

  findActiveOutlet(tx: Tx, outletId: string, organizationId: string) {
    return tx
      .select()
      .from(outlet)
      .where(and(eq(outlet.id, outletId), eq(outlet.organizationId, organizationId), eq(outlet.isActive, true)))
      .limit(1);
  },

  findOpenShift(tx: Tx, outletId: string, cashierUserId: string) {
    return tx
      .select()
      .from(shift)
      .where(and(eq(shift.outletId, outletId), eq(shift.cashierUserId, cashierUserId), eq(shift.status, "open")))
      .limit(1);
  },

  findShift(tx: Tx, shiftId: string) {
    return tx.select().from(shift).where(eq(shift.id, shiftId)).limit(1);
  },

  findActiveSku(tx: Tx, skuId: string, organizationId: string) {
    return tx
      .select()
      .from(sku)
      .where(and(eq(sku.id, skuId), eq(sku.organizationId, organizationId), eq(sku.isActive, true)))
      .limit(1);
  },

  findActiveSkuWithProduct(tx: Tx, skuId: string, organizationId: string) {
    return tx
      .select({
        id: sku.id,
        organizationId: sku.organizationId,
        productId: sku.productId,
        sku: sku.sku,
        barcode: sku.barcode,
        name: sku.name,
        baseUnitId: sku.baseUnitId,
        saleUnitId: sku.saleUnitId,
        saleUnitToBaseFactor: sku.saleUnitToBaseFactor,
        price: sku.price,
        cost: sku.cost,
        minStockBaseQty: sku.minStockBaseQty,
        isActive: sku.isActive,
        createdAt: sku.createdAt,
        updatedAt: sku.updatedAt,
        productCategory: product.category,
      })
      .from(sku)
      .innerJoin(product, eq(product.id, sku.productId))
      .where(and(eq(sku.id, skuId), eq(sku.organizationId, organizationId), eq(sku.isActive, true), eq(product.isActive, true)))
      .limit(1);
  },

  findUnit(tx: Tx, unitId: string, organizationId: string) {
    return tx.select().from(unit).where(and(eq(unit.id, unitId), eq(unit.organizationId, organizationId))).limit(1);
  },

  findBalance(tx: Tx, outletId: string, skuId: string) {
    return tx
      .select()
      .from(inventoryBalance)
      .where(and(eq(inventoryBalance.outletId, outletId), eq(inventoryBalance.skuId, skuId)))
      .limit(1);
  },

  createSale(tx: Tx, values: typeof sale.$inferInsert) {
    return tx.insert(sale).values(values).returning();
  },

  updateSale(tx: Tx, saleId: string, values: Partial<typeof sale.$inferInsert>) {
    return tx.update(sale).set(values).where(eq(sale.id, saleId)).returning();
  },

  createSaleItem(tx: Tx, values: typeof saleItem.$inferInsert) {
    return tx.insert(saleItem).values(values);
  },

  findSaleItemsTx(tx: Tx, saleId: string) {
    return tx.select().from(saleItem).where(eq(saleItem.saleId, saleId));
  },

  findSaleItemsWithProductPolicyTx(tx: Tx, saleId: string) {
    return tx
      .select({
        saleItemId: saleItem.id,
        skuId: saleItem.skuId,
        nameSnapshot: saleItem.nameSnapshot,
        productName: product.name,
        voidWindowHours: product.voidWindowHours,
        refundWindowHours: product.refundWindowHours,
      })
      .from(saleItem)
      .innerJoin(sku, eq(sku.id, saleItem.skuId))
      .innerJoin(product, eq(product.id, sku.productId))
      .where(eq(saleItem.saleId, saleId));
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

  createStockMovement(tx: Tx, values: typeof stockMovement.$inferInsert) {
    return tx.insert(stockMovement).values(values);
  },

  createPayment(tx: Tx, values: typeof payment.$inferInsert) {
    return tx.insert(payment).values(values);
  },

  findSalePaymentsTx(tx: Tx, saleId: string) {
    return tx.select().from(payment).where(eq(payment.saleId, saleId));
  },

  incrementShiftCash(tx: Tx, shiftId: string, cashTotal: number) {
    return tx
      .update(shift)
      .set({
        expectedCash: sql`${shift.expectedCash} + ${fixed(cashTotal)}`,
        updatedAt: new Date(),
      })
      .where(eq(shift.id, shiftId));
  },

  decrementShiftCash(tx: Tx, shiftId: string, cashTotal: number) {
    return tx
      .update(shift)
      .set({
        expectedCash: sql`${shift.expectedCash} - ${fixed(cashTotal)}`,
        updatedAt: new Date(),
      })
      .where(eq(shift.id, shiftId));
  },

  createAuditLog(tx: Tx, values: typeof auditLog.$inferInsert) {
    return tx.insert(auditLog).values(values);
  },

  findSaleById(id: string, organizationId: string) {
    return db
      .select()
      .from(sale)
      .where(and(eq(sale.id, id), eq(sale.organizationId, organizationId)))
      .limit(1);
  },

  findSaleItems(saleId: string) {
    return db.select().from(saleItem).where(eq(saleItem.saleId, saleId));
  },

  findSalePayments(saleId: string) {
    return db.select().from(payment).where(eq(payment.saleId, saleId));
  },
};

export type SalesActor = Actor;
