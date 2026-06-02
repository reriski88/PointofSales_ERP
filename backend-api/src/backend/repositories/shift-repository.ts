import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { payment, sale, shift, shiftCashMovement, user } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const shiftRepository = {
  transaction<T>(callback: (tx: Tx) => Promise<T>) {
    return db.transaction(callback);
  },

  findOpen(outletId: string, cashierUserId: string) {
    return db
      .select()
      .from(shift)
      .where(and(eq(shift.outletId, outletId), eq(shift.cashierUserId, cashierUserId), eq(shift.status, "open")))
      .limit(1);
  },

  create(values: typeof shift.$inferInsert) {
    return db.insert(shift).values(values).returning();
  },

  findById(id: string, organizationId: string) {
    return db
      .select()
      .from(shift)
      .where(and(eq(shift.id, id), eq(shift.organizationId, organizationId)))
      .limit(1);
  },

  close(id: string, values: Partial<typeof shift.$inferInsert>) {
    return db.update(shift).set(values).where(eq(shift.id, id)).returning();
  },

  closeTx(tx: Tx, id: string, values: Partial<typeof shift.$inferInsert>) {
    return tx.update(shift).set(values).where(eq(shift.id, id)).returning();
  },

  async createCashMovement(values: typeof shiftCashMovement.$inferInsert) {
    return db.transaction(async (tx) => {
      const [movement] = await tx.insert(shiftCashMovement).values(values).returning();
      const delta =
        values.type === "cash_in"
          ? sql`${shift.expectedCash} + ${values.amount}`
          : sql`${shift.expectedCash} - ${values.amount}`;
      const totals =
        values.type === "cash_in"
          ? { cashInTotal: sql`${shift.cashInTotal} + ${values.amount}` }
          : { cashOutTotal: sql`${shift.cashOutTotal} + ${values.amount}` };

      await tx
        .update(shift)
        .set({
          ...totals,
          expectedCash: delta,
          updatedAt: new Date(),
        })
        .where(and(eq(shift.id, values.shiftId), eq(shift.status, "open")));

      return movement;
    });
  },

  findCashMovements(shiftId: string, organizationId: string) {
    return db
      .select({
        id: shiftCashMovement.id,
        shiftId: shiftCashMovement.shiftId,
        type: shiftCashMovement.type,
        amount: shiftCashMovement.amount,
        reason: shiftCashMovement.reason,
        note: shiftCashMovement.note,
        actorUserId: shiftCashMovement.actorUserId,
        actorName: user.name,
        createdAt: shiftCashMovement.createdAt,
      })
      .from(shiftCashMovement)
      .leftJoin(user, eq(user.id, shiftCashMovement.actorUserId))
      .where(and(eq(shiftCashMovement.shiftId, shiftId), eq(shiftCashMovement.organizationId, organizationId)))
      .orderBy(desc(shiftCashMovement.createdAt));
  },

  paymentSummary(shiftId: string, organizationId: string) {
    return db
      .select({
        method: payment.method,
        amount: sql<string>`coalesce(sum(${payment.amount}), 0)`,
        count: sql<string>`count(${payment.id})`,
      })
      .from(payment)
      .innerJoin(sale, eq(sale.id, payment.saleId))
      .where(and(eq(sale.shiftId, shiftId), eq(sale.organizationId, organizationId), eq(sale.status, "completed")))
      .groupBy(payment.method)
      .orderBy(payment.method);
  },

  recalculateCashTotals(shiftId: string, organizationId: string) {
    return db.execute(sql`
      update ${shift}
      set
        cash_in_total = coalesce((
          select sum(${shiftCashMovement.amount})
          from ${shiftCashMovement}
          where ${shiftCashMovement.shiftId} = ${shift.id}
            and ${shiftCashMovement.organizationId} = ${organizationId}
            and ${shiftCashMovement.type} = 'cash_in'
        ), 0),
        cash_out_total = coalesce((
          select sum(${shiftCashMovement.amount})
          from ${shiftCashMovement}
          where ${shiftCashMovement.shiftId} = ${shift.id}
            and ${shiftCashMovement.organizationId} = ${organizationId}
            and ${shiftCashMovement.type} = 'cash_out'
        ), 0),
        updated_at = now()
      where ${shift.id} = ${shiftId}
        and ${shift.organizationId} = ${organizationId}
    `);
  },
};
