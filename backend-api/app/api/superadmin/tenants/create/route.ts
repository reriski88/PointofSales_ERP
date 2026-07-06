import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { organization, tenantSubscription, subscriptionPlan, outlet, user, userOutlet } from "@/db/schema";
import { ok, handleRouteError, ApiError, parseJson } from "@/lib/http";
import { requireActor } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

export const runtime = "nodejs";

const createTenantSchema = z.object({
  tenantName: z.string().min(1),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  address: z.string().optional(),
  ownerName: z.string().min(1),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  planId: z.string().uuid(),
  trialDays: z.coerce.number().int().min(0).default(14),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
});

export async function POST(request: NextRequest) {
  let ownerId: string | null = null;

  try {
    const actor = await requireActor(request);
    if (actor.role !== "superadmin") throw new ApiError("FORBIDDEN", "", 403);
    const body = await parseJson(request, createTenantSchema);

    // Validate plan exists before creating anything
    const [targetPlan] = await db
      .select({ id: subscriptionPlan.id, name: subscriptionPlan.name })
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.id, body.planId))
      .limit(1);

    if (!targetPlan) {
      throw new ApiError("NOT_FOUND", "Plan langganan tidak ditemukan. Pilih plan yang tersedia.", 404);
    }

    // Create owner user via Better Auth FIRST (outside transaction)
    // Better Auth uses its own DB connection and is NOT transaction-aware.
    // If we put this inside the transaction and the tx fails, the user becomes orphaned.
    await auth.api.signUpEmail({
      body: {
        email: body.ownerEmail,
        password: body.ownerPassword,
        name: body.ownerName,
      },
    });

    const [owner] = await db
      .select()
      .from(user)
      .where(eq(user.email, body.ownerEmail))
      .limit(1);

    if (!owner) throw new ApiError("INTERNAL_ERROR", "Gagal membuat user owner", 500);
    ownerId = owner.id;

    // Now run the rest in a transaction.
    // If this transaction fails, we clean up the orphaned user below.
    const result = await db.transaction(async (tx) => {
      // 1. Create organization
      const [org] = await tx
        .insert(organization)
        .values({
          name: body.tenantName,
          contactName: body.contactName,
          contactPhone: body.contactPhone,
          contactEmail: body.contactEmail,
          address: body.address,
        })
        .returning();

      // 2. Update owner with organizationId and role
      await tx
        .update(user)
        .set({ role: "owner", isActive: true, organizationId: org.id, updatedAt: new Date() })
        .where(eq(user.id, ownerId!));

      // 3. Create subscription
      const isTrial = body.trialDays > 0;
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + body.trialDays);
      const periodEnd = new Date();
      if (body.billingCycle === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      else periodEnd.setMonth(periodEnd.getMonth() + 1);

      const [sub] = await tx
        .insert(tenantSubscription)
        .values({
          organizationId: org.id,
          planId: body.planId,
          status: isTrial ? "trial" : "active",
          trialEndsAt: isTrial ? trialEnd : null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
          billingCycle: body.billingCycle,
        })
        .returning();

      // 4. Create default outlet
      const [defaultOutlet] = await tx
        .insert(outlet)
        .values({
          organizationId: org.id,
          name: "Outlet Utama",
          code: "OUTLET-UTAMA",
        })
        .returning();

      // 5. Assign owner to outlet
      await tx.insert(userOutlet).values({
        userId: ownerId!,
        outletId: defaultOutlet.id,
      });

      return { org, sub, outlet: defaultOutlet };
    });

    await writeAudit({
      actor,
      organizationId: result.org.id,
      action: "tenant.create",
      entityType: "organization",
      entityId: result.org.id,
      after: {
        organization: result.org,
        ownerId: ownerId!,
        subscription: result.sub,
        outlet: result.outlet,
        plan: targetPlan,
      },
      request,
    });

    return ok({ success: true, tenantId: result.org.id });
  } catch (error) {
    // Cleanup orphaned user if transaction failed after signUpEmail
    if (ownerId) {
      await db.delete(user).where(eq(user.id, ownerId)).catch(() => { /* best effort */ });
    }
    return handleRouteError(error);
  }
}
