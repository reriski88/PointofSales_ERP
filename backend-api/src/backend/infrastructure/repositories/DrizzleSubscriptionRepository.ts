/**
 * Drizzle Implementation of ISubscriptionRepository
 * Maps between DB rows and domain entities.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantSubscription, subscriptionPlan } from "@/db/schema";
import { TenantSubscriptionEntity } from "@/backend/domain/entities/TenantSubscriptionEntity";
import { SubscriptionPlanEntity } from "@/backend/domain/entities/SubscriptionPlanEntity";
import type { ISubscriptionRepository } from "@/backend/domain/interfaces/ISubscriptionRepository";

export class DrizzleSubscriptionRepository implements ISubscriptionRepository {
  async findByOrganizationId(organizationId: string): Promise<TenantSubscriptionEntity | null> {
    const [row] = await db
      .select()
      .from(tenantSubscription)
      .where(eq(tenantSubscription.organizationId, organizationId))
      .limit(1);
    if (!row) return null;
    return TenantSubscriptionEntity.fromRow(row);
  }

  async findPlanById(planId: string): Promise<SubscriptionPlanEntity | null> {
    const [row] = await db
      .select()
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.id, planId))
      .limit(1);
    if (!row) return null;
    return SubscriptionPlanEntity.fromRow(row);
  }

  async findAllPlans(): Promise<SubscriptionPlanEntity[]> {
    const rows = await db
      .select()
      .from(subscriptionPlan)
      .orderBy(subscriptionPlan.priceMonthly);
    return rows.map(SubscriptionPlanEntity.fromRow);
  }

  async save(entity: TenantSubscriptionEntity): Promise<void> {
    await db
      .update(tenantSubscription)
      .set({
        planId: entity.planId,
        status: entity.status.value as "trial" | "active" | "grace_period" | "suspended" | "cancelled" | "expired",
        trialEndsAt: entity.trialEndsAt,
        currentPeriodStart: entity.currentPeriodStart,
        currentPeriodEnd: entity.currentPeriodEnd,
        billingCycle: entity.billingCycle,
        autoRenew: entity.autoRenew,
        suspendedReason: entity.suspendedReason,
        updatedAt: new Date(),
      })
      .where(eq(tenantSubscription.organizationId, entity.organizationId));
  }
}
