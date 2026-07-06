/**
 * Domain Entity: TenantSubscription
 * Rich domain model with behavior (Tell, Don't Ask).
 * Immutable — state transitions return new instances.
 */
import { SubscriptionStatus } from "@/backend/domain/value-objects/SubscriptionStatus";

export class TenantSubscriptionEntity {
  private constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly planId: string,
    public readonly status: SubscriptionStatus,
    public readonly trialEndsAt: Date | null,
    public readonly currentPeriodStart: Date,
    public readonly currentPeriodEnd: Date,
    public readonly billingCycle: "monthly" | "yearly",
    public readonly autoRenew: boolean,
    public readonly suspendedReason: string | null,
  ) {}

  static fromRow(row: {
    id: string;
    organizationId: string;
    planId: string;
    status: string;
    trialEndsAt: Date | null;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    billingCycle: string;
    autoRenew: boolean;
    suspendedReason: string | null;
  }): TenantSubscriptionEntity {
    return new TenantSubscriptionEntity(
      row.id,
      row.organizationId,
      row.planId,
      SubscriptionStatus.from(row.status),
      row.trialEndsAt,
      row.currentPeriodStart,
      row.currentPeriodEnd,
      row.billingCycle as "monthly" | "yearly",
      row.autoRenew,
      row.suspendedReason,
    );
  }

  // --- Domain Behaviors (state transitions return new instance) ---

  /** Activate subscription (e.g., after payment confirmed) */
  activate(periodStart: Date, periodEnd: Date): TenantSubscriptionEntity {
    return new TenantSubscriptionEntity(
      this.id, this.organizationId, this.planId,
      SubscriptionStatus.active(),
      null, periodStart, periodEnd,
      this.billingCycle, this.autoRenew, null,
    );
  }

  /** Move to grace period — 7 days after period end */
  enterGracePeriod(): TenantSubscriptionEntity {
    if (!this.status.isActive) throw new Error("Only active subscriptions can enter grace period");
    return new TenantSubscriptionEntity(
      this.id, this.organizationId, this.planId,
      SubscriptionStatus.grace(),
      this.trialEndsAt, this.currentPeriodStart, new Date(),
      this.billingCycle, this.autoRenew, null,
    );
  }

  /** Mark as expired */
  expire(): TenantSubscriptionEntity {
    return new TenantSubscriptionEntity(
      this.id, this.organizationId, this.planId,
      SubscriptionStatus.expired(),
      this.trialEndsAt, this.currentPeriodStart, this.currentPeriodEnd,
      this.billingCycle, this.autoRenew, this.suspendedReason,
    );
  }

  /** Suspend with a reason */
  suspend(reason: string): TenantSubscriptionEntity {
    if (!reason.trim()) throw new Error("Suspension reason is required");
    return new TenantSubscriptionEntity(
      this.id, this.organizationId, this.planId,
      SubscriptionStatus.suspended(),
      this.trialEndsAt, this.currentPeriodStart, this.currentPeriodEnd,
      this.billingCycle, this.autoRenew, reason,
    );
  }

  cancel(): TenantSubscriptionEntity {
    return new TenantSubscriptionEntity(
      this.id, this.organizationId, this.planId,
      SubscriptionStatus.cancelled(),
      this.trialEndsAt, this.currentPeriodStart, this.currentPeriodEnd,
      this.billingCycle, false, null,
    );
  }

  // --- Queries ---

  /** Can this subscription be used right now? */
  get canAccess(): boolean {
    const now = new Date();
    if (this.status.isTerminated) return false;

    if (this.status.isTrial && this.trialEndsAt) {
      return new Date(this.trialEndsAt) >= now;
    }

    if (this.status.isActive) {
      const graceEnd = new Date(this.currentPeriodEnd);
      graceEnd.setDate(graceEnd.getDate() + 7);
      return now <= graceEnd;
    }

    if (this.status.isGrace) {
      const graceEnd = new Date(this.currentPeriodEnd);
      graceEnd.setDate(graceEnd.getDate() + 7);
      return now <= graceEnd;
    }

    return true;
  }

  /** Human-readable blocked reason, or null if can access */
  get blockedReason(): string | null {
    if (this.canAccess) return null;
    if (this.status.isSuspended) {
      return this.suspendedReason ?? "Langganan ditangguhkan. Hubungi IT Support.";
    }
    if (this.status.isCancelled || this.status.isExpired) {
      return "Langganan telah berakhir. Hubungi IT Support untuk perpanjangan.";
    }
    if (this.status.isTrial) {
      return "Masa uji coba telah berakhir. Hubungi IT Support untuk berlangganan.";
    }
    return "Langganan tidak aktif.";
  }
}
