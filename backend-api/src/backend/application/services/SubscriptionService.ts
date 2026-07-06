/**
 * Application Service: SubscriptionService
 * Orchestrates subscription business logic using domain entities + repository.
 * Thin — delegates to domain entities for state transitions.
 */
import { container } from "@/backend/infrastructure/di/container";
import { TenantSubscriptionEntity } from "@/backend/domain/entities/TenantSubscriptionEntity";
import type { ISubscriptionRepository } from "@/backend/domain/interfaces/ISubscriptionRepository";

export class SubscriptionService {
  constructor(private readonly repo: ISubscriptionRepository) {}

  /** Check if an organization can access the system. Returns blocked reason or null. */
  async checkAccess(organizationId: string): Promise<string | null> {
    const sub = await this.repo.findByOrganizationId(organizationId);
    if (!sub) return "Organisasi belum memiliki langganan aktif. Hubungi IT Support.";
    return sub.blockedReason;
  }

  /** Get subscription for organization */
  async getForOrganization(organizationId: string): Promise<TenantSubscriptionEntity | null> {
    return this.repo.findByOrganizationId(organizationId);
  }

  /** Activate subscription (payment confirmed) */
  async activate(organizationId: string, periodStart: Date, periodEnd: Date): Promise<TenantSubscriptionEntity> {
    const sub = await this.repo.findByOrganizationId(organizationId);
    if (!sub) throw new Error("Subscription not found");
    const activated = sub.activate(periodStart, periodEnd);
    await this.repo.save(activated);
    return activated;
  }

  /** Suspend subscription */
  async suspend(organizationId: string, reason: string): Promise<TenantSubscriptionEntity> {
    const sub = await this.repo.findByOrganizationId(organizationId);
    if (!sub) throw new Error("Subscription not found");
    const suspended = sub.suspend(reason);
    await this.repo.save(suspended);
    return suspended;
  }

  /** Cancel subscription */
  async cancel(organizationId: string): Promise<TenantSubscriptionEntity> {
    const sub = await this.repo.findByOrganizationId(organizationId);
    if (!sub) throw new Error("Subscription not found");
    const cancelled = sub.cancel();
    await this.repo.save(cancelled);
    return cancelled;
  }

  /** Check plan limit enforcement */
  async assertPlanLimit(organizationId: string): Promise<{ maxOutlets: number; maxUsers: number; maxSkus: number } | null> {
    const sub = await this.repo.findByOrganizationId(organizationId);
    if (!sub) return null;
    const plan = await this.repo.findPlanById(sub.planId);
    if (!plan) return null;
    return {
      maxOutlets: plan.limits.maxOutlets,
      maxUsers: plan.limits.maxUsers,
      maxSkus: plan.limits.maxSkus,
    };
  }

  /** Get all available plans */
  async getAllPlans() {
    return this.repo.findAllPlans();
  }
}

// DI token
export const SUBSCRIPTION_SERVICE = "SubscriptionService";
export const SUBSCRIPTION_REPO = "SubscriptionRepository";
