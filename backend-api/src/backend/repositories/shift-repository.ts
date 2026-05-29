import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { shift } from "@/db/schema";

export const shiftRepository = {
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
};
