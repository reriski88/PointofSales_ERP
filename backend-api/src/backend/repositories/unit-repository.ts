import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { unit } from "@/db/schema";

export const unitRepository = {
  findByOrganization(organizationId: string) {
    return db.select().from(unit).where(eq(unit.organizationId, organizationId));
  },

  create(values: typeof unit.$inferInsert) {
    return db.insert(unit).values(values).returning();
  },

  findById(id: string, organizationId: string) {
    return db
      .select()
      .from(unit)
      .where(and(eq(unit.id, id), eq(unit.organizationId, organizationId)));
  },

  update(id: string, organizationId: string, values: Partial<typeof unit.$inferInsert>) {
    return db
      .update(unit)
      .set(values)
      .where(and(eq(unit.id, id), eq(unit.organizationId, organizationId)))
      .returning();
  },
};
