/**
 * Value Object: SubscriptionStatus
 * Immutable, self-describing status with boolean checks.
 */
export type StatusValue = "trial" | "active" | "grace_period" | "suspended" | "cancelled" | "expired";

export class SubscriptionStatus {
  private constructor(private readonly _value: StatusValue) {}

  static from(value: string): SubscriptionStatus {
    const valid: StatusValue[] = ["trial", "active", "grace_period", "suspended", "cancelled", "expired"];
    if (!(valid as string[]).includes(value)) {
      throw new Error(`Invalid subscription status: ${value}`);
    }
    return new SubscriptionStatus(value as StatusValue);
  }

  static trial(): SubscriptionStatus   { return new SubscriptionStatus("trial"); }
  static active(): SubscriptionStatus  { return new SubscriptionStatus("active"); }
  static grace(): SubscriptionStatus   { return new SubscriptionStatus("grace_period"); }
  static suspended(): SubscriptionStatus { return new SubscriptionStatus("suspended"); }
  static cancelled(): SubscriptionStatus { return new SubscriptionStatus("cancelled"); }
  static expired(): SubscriptionStatus  { return new SubscriptionStatus("expired"); }

  get value(): StatusValue { return this._value; }

  get isTrial(): boolean     { return this._value === "trial"; }
  get isActive(): boolean    { return this._value === "active"; }
  get isGrace(): boolean     { return this._value === "grace_period"; }
  get isSuspended(): boolean { return this._value === "suspended"; }
  get isCancelled(): boolean { return this._value === "cancelled"; }
  get isExpired(): boolean   { return this._value === "expired"; }

  get isTerminated(): boolean {
    return this.isCancelled || this.isExpired || this.isSuspended;
  }

  equals(other: SubscriptionStatus): boolean {
    return this._value === other._value;
  }

  toString(): string { return this._value; }
}
