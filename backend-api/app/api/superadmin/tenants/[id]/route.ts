import { NextRequest } from "next/server";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  organization,
  tenantSubscription,
  subscriptionPlan,
  subscriptionPayment,
  outlet,
  user,
  sku,
} from "@/db/schema";
import { ok, handleRouteError, ApiError } from "@/lib/http";
import { requireActor } from "@/lib/rbac";
import { invalidateSubscriptionCache } from "@/lib/subscription-guard";
import { writeAudit } from "@/lib/audit";
import { z } from "zod";

export const runtime = "nodejs";

const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const updateSubscriptionSchema = z.object({
  planId: z.string().uuid().optional(),
  status: z.enum(["trial", "active", "grace_period", "suspended", "cancelled", "expired"]).optional(),
  trialEndsAt: z.string().datetime().nullable().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
  billingCycle: z.enum(["monthly", "yearly"]).optional(),
  suspendedReason: z.string().max(500).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    if (actor.role !== "superadmin") throw new ApiError("FORBIDDEN", "", 403);
    const { id } = await params;

    const [tenant] = await db
      .select({
        id: organization.id, name: organization.name,
        contactName: organization.contactName, contactPhone: organization.contactPhone,
        contactEmail: organization.contactEmail, address: organization.address,
        isActive: organization.isActive, createdAt: organization.createdAt,
        subId: tenantSubscription.id, subPlanId: tenantSubscription.planId,
        subPlanName: subscriptionPlan.name, subPlanCode: subscriptionPlan.code,
        subStatus: tenantSubscription.status, subTrialEndsAt: tenantSubscription.trialEndsAt,
        subPeriodStart: tenantSubscription.currentPeriodStart,
        subPeriodEnd: tenantSubscription.currentPeriodEnd,
        subBillingCycle: tenantSubscription.billingCycle,
        subAutoRenew: tenantSubscription.autoRenew,
        subSuspendedReason: tenantSubscription.suspendedReason,
      })
      .from(organization)
      .leftJoin(tenantSubscription, eq(tenantSubscription.organizationId, organization.id))
      .leftJoin(subscriptionPlan, eq(subscriptionPlan.id, tenantSubscription.planId))
      .where(eq(organization.id, id))
      .limit(1);

    if (!tenant) throw new ApiError("NOT_FOUND", "Tenant tidak ditemukan", 404);

    const payments = await db
      .select()
      .from(subscriptionPayment)
      .where(eq(subscriptionPayment.organizationId, id))
      .orderBy(subscriptionPayment.paidAt);

    return ok({ tenant, payments });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    if (actor.role !== "superadmin") throw new ApiError("FORBIDDEN", "", 403);
    const { id } = await params;
    const body = await request.json();

    const before = await loadTenantSnapshot(id);
    if (!before) throw new ApiError("NOT_FOUND", "Tenant tidak ditemukan", 404);

    await db.transaction(async (tx) => {
      if (body.tenant) {
        const t = updateTenantSchema.parse(body.tenant);
        await tx.update(organization).set({ ...t, updatedAt: new Date() }).where(eq(organization.id, id));
      }

      if (body.subscription) {
        const s = updateSubscriptionSchema.parse(body.subscription);
        if (s.planId && s.planId !== before.subPlanId) {
          await assertPlanDowngradeIsAllowed(id, s.planId);
        }

        const updateData: Partial<typeof tenantSubscription.$inferInsert> = { updatedAt: new Date() };
        if (s.planId) updateData.planId = s.planId;
        if (s.status) updateData.status = s.status;
        if (s.trialEndsAt !== undefined) updateData.trialEndsAt = s.trialEndsAt ? new Date(s.trialEndsAt) : null;
        if (s.currentPeriodEnd) updateData.currentPeriodEnd = new Date(s.currentPeriodEnd);
        if (s.billingCycle) updateData.billingCycle = s.billingCycle;
        if (s.suspendedReason !== undefined) updateData.suspendedReason = s.suspendedReason || null;

        if (s.status === "active") {
          updateData.suspendedAt = null;
          updateData.suspendedReason = null;
          updateData.cancelledAt = null;
        }
        if (s.status === "grace_period" && !s.currentPeriodEnd) {
          updateData.currentPeriodEnd = new Date();
        }
        if (s.status === "suspended") {
          updateData.suspendedAt = new Date();
        }
        if (s.status === "cancelled") {
          updateData.cancelledAt = new Date();
        }

        await tx.update(tenantSubscription)
          .set(updateData)
          .where(eq(tenantSubscription.organizationId, id));
      }
    });

    invalidateSubscriptionCache(id);
    const after = await loadTenantSnapshot(id);
    await writeAudit({
      actor,
      organizationId: id,
      action: "subscription.update",
      entityType: "tenant_subscription",
      entityId: before.subId ?? id,
      before,
      after,
      request,
    });

    return ok({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function loadTenantSnapshot(id: string) {
  const [row] = await db
    .select({
      id: organization.id,
      name: organization.name,
      contactName: organization.contactName,
      contactPhone: organization.contactPhone,
      contactEmail: organization.contactEmail,
      address: organization.address,
      isActive: organization.isActive,
      subId: tenantSubscription.id,
      subPlanId: tenantSubscription.planId,
      subStatus: tenantSubscription.status,
      subTrialEndsAt: tenantSubscription.trialEndsAt,
      subPeriodStart: tenantSubscription.currentPeriodStart,
      subPeriodEnd: tenantSubscription.currentPeriodEnd,
      subBillingCycle: tenantSubscription.billingCycle,
      subSuspendedReason: tenantSubscription.suspendedReason,
    })
    .from(organization)
    .leftJoin(tenantSubscription, eq(tenantSubscription.organizationId, organization.id))
    .where(eq(organization.id, id))
    .limit(1);
  return row;
}

async function assertPlanDowngradeIsAllowed(organizationId: string, planId: string) {
  const [plan] = await db.select().from(subscriptionPlan).where(eq(subscriptionPlan.id, planId)).limit(1);
  if (!plan) throw new ApiError("NOT_FOUND", "Plan langganan tidak ditemukan", 404);

  const [[outletCount], [userCount], [skuCount]] = await Promise.all([
    db.select({ value: count() }).from(outlet).where(eq(outlet.organizationId, organizationId)),
    db.select({ value: count() }).from(user).where(eq(user.organizationId, organizationId)),
    db.select({ value: count() }).from(sku).where(eq(sku.organizationId, organizationId)),
  ]);

  const violations = [
    { label: "outlet", current: outletCount?.value ?? 0, limit: plan.maxOutlets },
    { label: "user", current: userCount?.value ?? 0, limit: plan.maxUsers },
    { label: "SKU", current: skuCount?.value ?? 0, limit: plan.maxSkus },
  ].filter((item) => item.current > item.limit);

  if (violations.length) {
    throw new ApiError(
      "CONFLICT",
      `Tidak bisa mengganti plan ke ${plan.name}. Penggunaan saat ini melebihi limit: ${violations
        .map((item) => `${item.current} ${item.label} / limit ${item.limit}`)
        .join(", ")}. Kurangi data terlebih dahulu atau pilih plan lebih tinggi.`,
      409,
    );
  }
}
