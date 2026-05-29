import { eq } from "drizzle-orm";
import { db } from "@/db";
import { unit } from "@/db/schema";

export const unitRepository = {
  findByOrganization(organizationId: string) {
    return db.select().from(unit).where(eq(unit.organizationId, organizationId));
  },

  create(values: typeof unit.$inferInsert) {
    return db.insert(unit).values(values).returning();
  },
};
