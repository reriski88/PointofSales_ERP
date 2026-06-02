import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/schema";

export const organizationRepository = {
  ensureRolePermissionsColumn() {
    return db.execute(sql`ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "role_permissions" jsonb`);
  },

  findSettings(id: string) {
    return db
      .select({
        id: organization.id,
        name: organization.name,
        defaultOutletLogoUrl: organization.logoUrl,
        receiptLayout: organization.receiptLayout,
        posSettings: organization.posSettings,
      })
      .from(organization)
      .where(eq(organization.id, id))
      .limit(1);
  },

  updateSettings(
    id: string,
    values: {
      logoUrl?: string | null;
      receiptLayout?: unknown;
      posSettings?: unknown;
      updatedAt: Date;
    },
  ) {
    return db
      .update(organization)
      .set(values)
      .where(eq(organization.id, id))
      .returning({
        id: organization.id,
        name: organization.name,
        defaultOutletLogoUrl: organization.logoUrl,
        receiptLayout: organization.receiptLayout,
        posSettings: organization.posSettings,
      });
  },

  findRolePermissions(id: string) {
    return db
      .select({ rolePermissions: organization.rolePermissions })
      .from(organization)
      .where(eq(organization.id, id))
      .limit(1);
  },

  updateRolePermissions(id: string, rolePermissions: unknown) {
    return db
      .update(organization)
      .set({
        rolePermissions,
        updatedAt: new Date(),
      })
      .where(eq(organization.id, id));
  },
};
