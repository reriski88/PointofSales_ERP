import { NextRequest } from "next/server";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { tenantSubscription } from "@/db/schema";
import { handleRouteError, ok, ApiError } from "@/lib/http";
import { requireActor } from "@/lib/rbac";
import { invalidateSubscriptionCache } from "@/lib/subscription-guard";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return runSubscriptionCheck(request);
}

export async function POST(request: NextRequest) {
  return runSubscriptionCheck(request);
}

async function runSubscriptionCheck(request: NextRequest) {
  try {
    await authorizeCronRequest(request);

    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const expiredTrials = await tx
        .update(tenantSubscription)
        .set({ status: "expired", updatedAt: now })
        .where(and(eq(tenantSubscription.status, "trial"), lt(tenantSubscription.trialEndsAt, now)))
        .returning({ organizationId: tenantSubscription.organizationId });

      const expiredActive = await tx
        .update(tenantSubscription)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            eq(tenantSubscription.status, "active"),
            sql`${tenantSubscription.currentPeriodEnd} + interval '7 days' < ${now}`,
          ),
        )
        .returning({ organizationId: tenantSubscription.organizationId });

      const activeToGrace = await tx
        .update(tenantSubscription)
        .set({ status: "grace_period", updatedAt: now })
        .where(and(eq(tenantSubscription.status, "active"), lt(tenantSubscription.currentPeriodEnd, now)))
        .returning({ organizationId: tenantSubscription.organizationId });

      const expiredGrace = await tx
        .update(tenantSubscription)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            eq(tenantSubscription.status, "grace_period"),
            sql`${tenantSubscription.currentPeriodEnd} + interval '7 days' < ${now}`,
          ),
        )
        .returning({ organizationId: tenantSubscription.organizationId });

      return { expiredTrials, expiredActive, activeToGrace, expiredGrace };
    });

    const affectedOrganizationIds = new Set([
      ...result.expiredTrials,
      ...result.expiredActive,
      ...result.activeToGrace,
      ...result.expiredGrace,
    ].map((row) => row.organizationId));
    for (const organizationId of affectedOrganizationIds) {
      invalidateSubscriptionCache(organizationId);
    }

    return ok({
      success: true,
      checkedAt: now.toISOString(),
      expiredTrials: result.expiredTrials.length,
      expiredActive: result.expiredActive.length,
      activeToGrace: result.activeToGrace.length,
      expiredGrace: result.expiredGrace.length,
      affectedOrganizations: affectedOrganizationIds.size,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function authorizeCronRequest(request: NextRequest) {
  const configuredSecret = process.env.SUBSCRIPTION_CRON_SECRET;
  const headerSecret = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (configuredSecret && headerSecret === configuredSecret) return;

  const actor = await requireActor(request, { skipSubscriptionCheck: true });
  if (actor.role !== "superadmin") {
    throw new ApiError("FORBIDDEN", "Only superadmin can run subscription checks", 403);
  }
}
