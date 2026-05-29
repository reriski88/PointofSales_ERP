import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { outlet, userOutlet } from "@/db/schema";

export const outletRepository = {
  findByOrganization(organizationId: string) {
    return db.select().from(outlet).where(eq(outlet.organizationId, organizationId));
  },

  findActiveByUser(userId: string, organizationId: string) {
    return db
      .select({
        id: outlet.id,
        organizationId: outlet.organizationId,
        name: outlet.name,
        code: outlet.code,
        address: outlet.address,
        logoUrl: outlet.logoUrl,
        isActive: outlet.isActive,
        createdAt: outlet.createdAt,
        updatedAt: outlet.updatedAt,
      })
      .from(outlet)
      .innerJoin(userOutlet, eq(userOutlet.outletId, outlet.id))
      .where(and(eq(userOutlet.userId, userId), eq(outlet.organizationId, organizationId), eq(outlet.isActive, true)));
  },

  create(values: typeof outlet.$inferInsert) {
    return db.insert(outlet).values(values).returning();
  },

  findById(id: string, organizationId: string) {
    return db
      .select()
      .from(outlet)
      .where(and(eq(outlet.id, id), eq(outlet.organizationId, organizationId)))
      .limit(1);
  },

  update(id: string, values: Partial<typeof outlet.$inferInsert>) {
    return db.update(outlet).set(values).where(eq(outlet.id, id)).returning();
  },
};
