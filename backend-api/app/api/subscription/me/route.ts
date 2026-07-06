import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantSubscription, subscriptionPlan } from "@/db/schema";
import { handleRouteError, ok } from "@/lib/http";
import { requireActor } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request, { skipSubscriptionCheck: true });
    if (actor.role === "superadmin") {
      return ok({ role: "superadmin" });
    }

    const [sub] = await db
      .select({
        id: tenantSubscription.id,
        status: tenantSubscription.status,
        trialEndsAt: tenantSubscription.trialEndsAt,
        currentPeriodStart: tenantSubscription.currentPeriodStart,
        currentPeriodEnd: tenantSubscription.currentPeriodEnd,
        billingCycle: tenantSubscription.billingCycle,
        autoRenew: tenantSubscription.autoRenew,
        planName: subscriptionPlan.name,
        planCode: subscriptionPlan.code,
        priceMonthly: subscriptionPlan.priceMonthly,
        maxOutlets: subscriptionPlan.maxOutlets,
        maxUsers: subscriptionPlan.maxUsers,
        maxSkus: subscriptionPlan.maxSkus,
      })
      .from(tenantSubscription)
      .innerJoin(subscriptionPlan, eq(subscriptionPlan.id, tenantSubscription.planId))
      .where(eq(tenantSubscription.organizationId, actor.organizationId))
      .limit(1);

    if (!sub) {
      return ok({ subscription: null });
    }

    const now = new Date();
    const trialActive = sub.status === "trial" && sub.trialEndsAt && new Date(sub.trialEndsAt) > now;
    const periodActive = sub.status === "active" && new Date(sub.currentPeriodEnd) > now;
    const inGrace =
      (sub.status === "active" && new Date(sub.currentPeriodEnd) <= now) ||
      sub.status === "grace_period";
    const isExpired = sub.status === "expired" || sub.status === "cancelled" || sub.status === "suspended";

    return ok({
      subscription: {
        planName: sub.planName,
        planCode: sub.planCode,
        priceMonthly: sub.priceMonthly,
        status: sub.status,
        trialEndsAt: sub.trialEndsAt,
        periodEnd: sub.currentPeriodEnd,
        billingCycle: sub.billingCycle,
        autoRenew: sub.autoRenew,
        healthy: trialActive || periodActive || inGrace,
        isTrial: sub.status === "trial" && trialActive,
        isGrace: inGrace && !isExpired,
        isExpired,
        limits: {
          maxOutlets: sub.maxOutlets,
          maxUsers: sub.maxUsers,
          maxSkus: sub.maxSkus,
        },
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
