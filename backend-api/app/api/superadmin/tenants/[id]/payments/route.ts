import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { tenantSubscription, subscriptionPayment, subscriptionPlan } from "@/db/schema";
import { created, handleRouteError, ApiError, parseJson } from "@/lib/http";
import { requireActor } from "@/lib/rbac";
import { invalidateSubscriptionCache } from "@/lib/subscription-guard";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const paymentSchema = z.object({
  amount: z.coerce.number().min(0),
  method: z.string().trim().max(80).optional(),
  reference: z.string().trim().max(120).optional(),
  months: z.coerce.number().int().min(1).max(36).default(1),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    if (actor.role !== "superadmin") throw new ApiError("FORBIDDEN", "", 403);
    const { id } = await params;
    const body = await parseJson(request, paymentSchema);
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      const [sub] = await tx.select().from(tenantSubscription).where(eq(tenantSubscription.organizationId, id)).limit(1);
      if (!sub) throw new ApiError("NOT_FOUND", "Subscription tenant tidak ditemukan", 404);
      const [plan] = await tx.select().from(subscriptionPlan).where(eq(subscriptionPlan.id, sub.planId)).limit(1);
      const start = new Date(Math.max(now.getTime(), new Date(sub.currentPeriodEnd).getTime()));
      const end = new Date(start);
      if (sub.billingCycle === "yearly") end.setFullYear(end.getFullYear() + body.months);
      else end.setMonth(end.getMonth() + body.months);
      const amount = body.amount || Number(plan?.priceMonthly ?? 0) * body.months;

      const [payment] = await tx.insert(subscriptionPayment).values({
        tenantSubscriptionId: sub.id,
        organizationId: id,
        amount: amount.toFixed(2),
        method: body.method || "manual",
        reference: body.reference,
        periodStart: start,
        periodEnd: end,
        status: "confirmed",
        note: body.note,
        createdBy: actor.id,
        paidAt: now,
      }).returning();

      const [updatedSub] = await tx.update(tenantSubscription).set({
        status: "active",
        currentPeriodStart: start,
        currentPeriodEnd: end,
        suspendedAt: null,
        suspendedReason: null,
        cancelledAt: null,
        updatedAt: now,
      }).where(eq(tenantSubscription.id, sub.id)).returning();

      return { payment, subscription: updatedSub };
    });

    invalidateSubscriptionCache(id);
    await writeAudit({
      actor,
      organizationId: id,
      action: "subscription.payment.confirm",
      entityType: "subscription_payment",
      entityId: result.payment.id,
      after: result,
      request,
    });

    return created(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
