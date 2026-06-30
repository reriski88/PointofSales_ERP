import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customer,
  customerReceivable,
  customerReceivablePayment,
  outlet,
  sale,
} from "@/db/schema";
import { fixed } from "@/lib/number";
import type { ListQuery } from "@/lib/http";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const customerRepository = {
  transaction<T>(callback: (tx: Tx) => Promise<T>) {
    return db.transaction(callback);
  },

  findCustomers(organizationId: string, options: ListQuery = {}) {
    const search = options.search ? `%${options.search}%` : undefined;

    return db
      .select({
        id: customer.id,
        code: customer.code,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        loyaltyPoints: customer.loyaltyPoints,
        totalSpent: customer.totalSpent,
        isActive: customer.isActive,
        receivableBalance: sql<string>`coalesce(sum(${customerReceivable.amount} - ${customerReceivable.paidTotal}) filter (where ${customerReceivable.status} in ('open', 'partial')), 0)::text`,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      })
      .from(customer)
      .leftJoin(customerReceivable, eq(customerReceivable.customerId, customer.id))
      .where(
        and(
          eq(customer.organizationId, organizationId),
          search ? or(ilike(customer.name, search), ilike(customer.code, search), ilike(customer.phone, search)) : undefined,
        ),
      )
      .groupBy(customer.id)
      .orderBy(customer.name)
      .limit(options.limit ?? 500)
      .offset(options.offset ?? 0);
  },

  findActiveCustomer(tx: Tx, customerId: string, organizationId: string) {
    return tx
      .select()
      .from(customer)
      .where(and(eq(customer.id, customerId), eq(customer.organizationId, organizationId), eq(customer.isActive, true)))
      .limit(1);
  },

  createCustomer(values: typeof customer.$inferInsert) {
    return db.insert(customer).values(values).returning();
  },

  findCustomerById(id: string, organizationId: string) {
    return db
      .select()
      .from(customer)
      .where(and(eq(customer.id, id), eq(customer.organizationId, organizationId)))
      .limit(1);
  },

  updateCustomer(id: string, organizationId: string, values: Partial<typeof customer.$inferInsert>) {
    return db
      .update(customer)
      .set(values)
      .where(and(eq(customer.id, id), eq(customer.organizationId, organizationId)))
      .returning();
  },

  incrementCustomerStats(tx: Tx, customerId: string, totalSpent: number, loyaltyPoints: number) {
    return tx
      .update(customer)
      .set({
        totalSpent: sql`${customer.totalSpent} + ${fixed(totalSpent)}`,
        loyaltyPoints: sql`${customer.loyaltyPoints} + ${loyaltyPoints}`,
        updatedAt: new Date(),
      })
      .where(eq(customer.id, customerId));
  },

  createReceivable(tx: Tx, values: typeof customerReceivable.$inferInsert) {
    return tx.insert(customerReceivable).values(values).returning();
  },

  findReceivables(organizationId: string, outletId?: string | null) {
    const conditions = [eq(customerReceivable.organizationId, organizationId)];
    if (outletId) conditions.push(eq(customerReceivable.outletId, outletId));

    return db
      .select({
        id: customerReceivable.id,
        outletId: customerReceivable.outletId,
        outletName: outlet.name,
        customerId: customerReceivable.customerId,
        customerName: customer.name,
        customerCode: customer.code,
        saleId: customerReceivable.saleId,
        receiptNumber: sale.receiptNumber,
        status: customerReceivable.status,
        amount: customerReceivable.amount,
        paidTotal: customerReceivable.paidTotal,
        dueDate: customerReceivable.dueDate,
        note: customerReceivable.note,
        createdAt: customerReceivable.createdAt,
      })
      .from(customerReceivable)
      .innerJoin(customer, eq(customer.id, customerReceivable.customerId))
      .innerJoin(outlet, eq(outlet.id, customerReceivable.outletId))
      .innerJoin(sale, eq(sale.id, customerReceivable.saleId))
      .where(and(...conditions))
      .orderBy(desc(customerReceivable.createdAt))
      .limit(500);
  },

  findCustomerSales(organizationId: string, customerId: string, outletIds?: string[]) {
    const conditions = [eq(sale.organizationId, organizationId), eq(sale.customerId, customerId)];
    if (outletIds) {
      if (!outletIds.length) return Promise.resolve([]);
      conditions.push(inArray(sale.outletId, outletIds));
    }

    return db
      .select({
        id: sale.id,
        receiptNumber: sale.receiptNumber,
        outletName: outlet.name,
        status: sale.status,
        grandTotal: sale.grandTotal,
        createdAt: sale.createdAt,
        receivableStatus: customerReceivable.status,
      })
      .from(sale)
      .innerJoin(outlet, eq(outlet.id, sale.outletId))
      .leftJoin(customerReceivable, eq(customerReceivable.saleId, sale.id))
      .where(and(...conditions))
      .orderBy(desc(sale.createdAt))
      .limit(100);
  },

  findReceivable(tx: Tx, id: string, organizationId: string) {
    return tx
      .select()
      .from(customerReceivable)
      .where(and(eq(customerReceivable.id, id), eq(customerReceivable.organizationId, organizationId)))
      .limit(1);
  },

  createReceivablePayment(tx: Tx, values: typeof customerReceivablePayment.$inferInsert) {
    return tx.insert(customerReceivablePayment).values(values).returning();
  },

  updateReceivable(tx: Tx, id: string, values: Partial<typeof customerReceivable.$inferInsert>) {
    return tx.update(customerReceivable).set(values).where(eq(customerReceivable.id, id)).returning();
  },

};
