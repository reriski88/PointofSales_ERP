import { desc, eq, sql } from "drizzle-orm";
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
        publicApiUrl: organization.publicApiUrl,
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
        publicApiUrl: organization.publicApiUrl,
      });
  },

  findLatestPublicUrl() {
    return db
      .select({
        publicApiUrl: organization.publicApiUrl,
        updatedAt: organization.updatedAt,
      })
      .from(organization)
      .orderBy(desc(organization.updatedAt))
      .limit(1);
  },

  updatePublicUrl(publicApiUrl: string, updatedAt: Date) {
    return db
      .update(organization)
      .set({
        publicApiUrl,
        updatedAt,
      })
      .returning({
        id: organization.id,
        publicApiUrl: organization.publicApiUrl,
        updatedAt: organization.updatedAt,
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
