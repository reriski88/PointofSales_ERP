import { NextRequest } from "next/server";
import { db } from "@/db";
import { organization, tenantSubscription, subscriptionPlan, user } from "@/db/schema";
import { eq, count, desc, and, sql } from "drizzle-orm";
import { ok, handleRouteError, ApiError } from "@/lib/http";
import { requireActor } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor(request);
    if (actor.role !== "superadmin") throw new ApiError("FORBIDDEN", "", 403);

    const [orgCount] = await db.select({ value: count() }).from(organization);
    const [userCount] = await db.select({ value: count() }).from(user);
    const [activeSubs] = await db.select({ value: count() }).from(tenantSubscription).where(eq(tenantSubscription.status, "active"));
    const [trialSubs] = await db.select({ value: count() }).from(tenantSubscription).where(eq(tenantSubscription.status, "trial"));
    const [overdueActive] = await db
      .select({ value: count() })
      .from(tenantSubscription)
      .where(and(eq(tenantSubscription.status, "active"), sql`${tenantSubscription.currentPeriodEnd} < now()`));
    const [expiringSoon] = await db
      .select({ value: count() })
      .from(tenantSubscription)
      .where(
        and(
          eq(tenantSubscription.status, "active"),
          sql`${tenantSubscription.currentPeriodEnd} >= now()`,
          sql`${tenantSubscription.currentPeriodEnd} <= now() + interval '7 days'`,
        ),
      );
    const [graceExpiring] = await db
      .select({ value: count() })
      .from(tenantSubscription)
      .where(
        and(
          eq(tenantSubscription.status, "grace_period"),
          sql`${tenantSubscription.currentPeriodEnd} + interval '7 days' <= now() + interval '2 days'`,
        ),
      );

    const recentTenants = await db
      .select({
        id: organization.id,
        name: organization.name,
        contactPhone: organization.contactPhone,
        ownerEmail: user.email,
        status: tenantSubscription.status,
        planName: subscriptionPlan.name,
        periodEnd: tenantSubscription.currentPeriodEnd,
      })
      .from(organization)
      .leftJoin(tenantSubscription, eq(tenantSubscription.organizationId, organization.id))
      .leftJoin(subscriptionPlan, eq(subscriptionPlan.id, tenantSubscription.planId))
      .leftJoin(user, and(eq(user.organizationId, organization.id), eq(user.role, "owner")))
      .orderBy(desc(organization.createdAt))
      .limit(10);

    return ok({
      orgCount: orgCount?.value ?? 0,
      userCount: userCount?.value ?? 0,
      activeSubs: activeSubs?.value ?? 0,
      trialSubs: trialSubs?.value ?? 0,
      overdueActive: overdueActive?.value ?? 0,
      expiringSoon: expiringSoon?.value ?? 0,
      graceExpiring: graceExpiring?.value ?? 0,
      recentTenants,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
