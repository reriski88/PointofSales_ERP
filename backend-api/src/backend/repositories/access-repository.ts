import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organization, outlet, user, userOutlet } from "@/db/schema";

export const accessRepository = {
  findUserById(id: string) {
    return db.select().from(user).where(eq(user.id, id)).limit(1);
  },

  findRolePermissions(organizationId: string) {
    return db
      .select({ rolePermissions: organization.rolePermissions })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
  },

  findOutletActiveState(outletId: string, organizationId: string) {
    return db
      .select({ isActive: outlet.isActive })
      .from(outlet)
      .where(and(eq(outlet.id, outletId), eq(outlet.organizationId, organizationId)))
      .limit(1);
  },

  findUserOutletAccess(userId: string, outletId: string) {
    return db
      .select({ userId: userOutlet.userId })
      .from(userOutlet)
      .where(and(eq(userOutlet.userId, userId), eq(userOutlet.outletId, outletId)))
      .limit(1);
  },

  findOutletIdsByOrganization(organizationId: string) {
    return db.select({ id: outlet.id }).from(outlet).where(eq(outlet.organizationId, organizationId));
  },

  findActiveOutletIdsByUser(userId: string, organizationId: string) {
    return db
      .select({ id: outlet.id })
      .from(outlet)
      .innerJoin(userOutlet, eq(userOutlet.outletId, outlet.id))
      .where(and(eq(userOutlet.userId, userId), eq(outlet.organizationId, organizationId), eq(outlet.isActive, true)));
  },
};
