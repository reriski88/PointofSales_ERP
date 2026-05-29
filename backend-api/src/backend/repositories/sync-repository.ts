import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { syncQueue } from "@/db/schema";

export const syncRepository = {
  receive(values: typeof syncQueue.$inferInsert) {
    return db.insert(syncQueue).values(values).onConflictDoNothing().returning();
  },

  updateByIdempotencyKey(
    organizationId: string,
    idempotencyKey: string,
    values: Partial<typeof syncQueue.$inferInsert>,
  ) {
    return db
      .update(syncQueue)
      .set(values)
      .where(and(eq(syncQueue.organizationId, organizationId), eq(syncQueue.idempotencyKey, idempotencyKey)));
  },
};
