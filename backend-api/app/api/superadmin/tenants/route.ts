import { NextRequest } from "next/server";
import { db } from "@/db";
import { organization, tenantSubscription, subscriptionPlan, user } from "@/db/schema";
import { eq, ilike, or, desc, and } from "drizzle-orm";
import { ok, handleRouteError, ApiError } from "@/lib/http";
import { requireActor } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor(request);
    if (actor.role !== "superadmin") throw new ApiError("FORBIDDEN", "", 403);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    const conditions = [];
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(or(
        ilike(organization.name, pattern),
        ilike(organization.contactName, pattern),
        ilike(organization.contactPhone, pattern),
        ilike(user.email, pattern),
        ilike(user.name, pattern),
      ));
    }

    // Owner user alias
    const ownerUser = user; // join on same table, filter by role

    const tenants = await db
      .select({
        id: organization.id,
        name: organization.name,
        contactName: organization.contactName,
        contactPhone: organization.contactPhone,
        contactEmail: organization.contactEmail,
        address: organization.address,
        isActive: organization.isActive,
        createdAt: organization.createdAt,
        ownerEmail: user.email,
        ownerName: user.name,
        subId: tenantSubscription.id,
        subPlanName: subscriptionPlan.name,
        subPlanCode: subscriptionPlan.code,
        subStatus: tenantSubscription.status,
        subPeriodStart: tenantSubscription.currentPeriodStart,
        subPeriodEnd: tenantSubscription.currentPeriodEnd,
        subTrialEndsAt: tenantSubscription.trialEndsAt,
        subBillingCycle: tenantSubscription.billingCycle,
      })
      .from(organization)
      .leftJoin(tenantSubscription, eq(tenantSubscription.organizationId, organization.id))
      .leftJoin(subscriptionPlan, eq(subscriptionPlan.id, tenantSubscription.planId))
      .leftJoin(user, and(eq(user.organizationId, organization.id), eq(user.role, "owner")))
      .where(conditions.length ? or(...conditions) : undefined)
      .orderBy(desc(organization.createdAt))
      .limit(100);

    return ok(tenants);
  } catch (error) {
    return handleRouteError(error);
  }
}
