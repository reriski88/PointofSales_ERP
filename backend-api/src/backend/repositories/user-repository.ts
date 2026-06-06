import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { account, outlet, user, userOutlet } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const userRepository = {
  findManyWithOutlets(organizationId: string) {
    return db.query.user.findMany({
      where: eq(user.organizationId, organizationId),
      with: {
        outlets: {
          with: {
            outlet: true,
          },
        },
      },
    });
  },

  findById(id: string, organizationId: string) {
    return db
      .select()
      .from(user)
      .where(and(eq(user.id, id), eq(user.organizationId, organizationId)))
      .limit(1);
  },

  findSharedOutlet(userId: string, outletIds: string[]) {
    return db
      .select({ outletId: userOutlet.outletId })
      .from(userOutlet)
      .where(and(eq(userOutlet.userId, userId), inArray(userOutlet.outletId, outletIds)))
      .limit(1);
  },

  findOutletIdsInOrganization(outletIds: string[], organizationId: string) {
    return db
      .select({ id: outlet.id })
      .from(outlet)
      .where(and(eq(outlet.organizationId, organizationId), inArray(outlet.id, outletIds)));
  },

  findEmailOwner(email: string, excludedUserId: string) {
    return db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.email, email), ne(user.id, excludedUserId)))
      .limit(1);
  },

  findCredentialAccount(userId: string) {
    return db
      .select({ password: account.password })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
      .limit(1);
  },

  updatePassword(userId: string, password: string) {
    return db
      .update(account)
      .set({ password, updatedAt: new Date() })
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  },

  completeCreatedUser(userId: string, values: Partial<typeof user.$inferInsert>, outletIds: string[]) {
    return db.transaction(async (tx) => {
      const [updatedUser] = await tx.update(user).set(values).where(eq(user.id, userId)).returning();

      for (const outletId of outletIds) {
        await tx
          .insert(userOutlet)
          .values({
            userId: updatedUser.id,
            outletId,
          })
          .onConflictDoNothing();
      }

      return updatedUser;
    });
  },

  updateUserWithAccess(
    userId: string,
    userValues: Partial<typeof user.$inferInsert>,
    outletIds: string[] | undefined,
    managedOutletIds: string[] | null,
    password: string | undefined,
  ) {
    return db.transaction(async (tx) => {
      const [updatedUser] = await tx.update(user).set(userValues).where(eq(user.id, userId)).returning();

      if (outletIds) {
        await userRepository.replaceUserOutlets(tx, userId, outletIds, managedOutletIds);
      }

      if (password) {
        await tx
          .update(account)
          .set({
            password,
            updatedAt: new Date(),
          })
          .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
      }

      return updatedUser;
    });
  },

  async replaceUserOutlets(tx: Tx, userId: string, outletIds: string[], managedOutletIds: string[] | null) {
    if (managedOutletIds) {
      await tx.delete(userOutlet).where(and(eq(userOutlet.userId, userId), inArray(userOutlet.outletId, managedOutletIds)));
    } else {
      await tx.delete(userOutlet).where(eq(userOutlet.userId, userId));
    }

    for (const outletId of outletIds) {
      await tx
        .insert(userOutlet)
        .values({
          userId,
          outletId,
        })
        .onConflictDoNothing();
    }
  },

  updateProfile(userId: string, values: { name: string; image?: string | null }) {
    return db
      .update(user)
      .set({
        name: values.name,
        ...(values.image !== undefined ? { image: values.image } : {}),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      });
  },
};
