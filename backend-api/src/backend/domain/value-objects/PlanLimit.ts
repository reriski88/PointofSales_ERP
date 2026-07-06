/**
 * Value Object: PlanLimit
 * Represents resource limits for a subscription plan.
 */
export class PlanLimit {
  private constructor(
    public readonly maxOutlets: number,
    public readonly maxUsers: number,
    public readonly maxSkus: number,
  ) {
    if (maxOutlets < 1) throw new Error("maxOutlets must be >= 1");
    if (maxUsers < 1) throw new Error("maxUsers must be >= 1");
    if (maxSkus < 1) throw new Error("maxSkus must be >= 1");
  }

  static create(maxOutlets: number, maxUsers: number, maxSkus: number): PlanLimit {
    return new PlanLimit(maxOutlets, maxUsers, maxSkus);
  }

  isUnlimited(field: "maxOutlets" | "maxUsers" | "maxSkus"): boolean {
    return this[field] >= 999;
  }
}
