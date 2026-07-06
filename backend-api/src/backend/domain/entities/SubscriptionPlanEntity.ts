/**
 * Domain Entity: SubscriptionPlan (read-only projection)
 * Mirrors the subscription_plan table as an immutable domain object.
 */
import { Money } from "@/backend/domain/value-objects/Money";
import { PlanLimit } from "@/backend/domain/value-objects/PlanLimit";

export class SubscriptionPlanEntity {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly code: string,
    public readonly priceMonthly: Money,
    public readonly priceYearly: Money,
    public readonly limits: PlanLimit,
    public readonly isActive: boolean,
  ) {}

  static fromRow(row: {
    id: string;
    name: string;
    code: string;
    priceMonthly: string;
    priceYearly: string;
    maxOutlets: number;
    maxUsers: number;
    maxSkus: number;
    isActive: boolean;
  }): SubscriptionPlanEntity {
    return new SubscriptionPlanEntity(
      row.id,
      row.name,
      row.code,
      Money.from(row.priceMonthly),
      Money.from(row.priceYearly),
      PlanLimit.create(row.maxOutlets, row.maxUsers, row.maxSkus),
      row.isActive,
    );
  }
}
