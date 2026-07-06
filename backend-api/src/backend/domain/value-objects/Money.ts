/**
 * Value Object: Money
 * Immutable, self-validating, no external dependencies.
 */
export class Money {
  private constructor(
    private readonly _amount: number,
    private readonly _currency: string = "IDR",
  ) {
    if (!Number.isFinite(_amount)) throw new Error("Money amount must be finite");
    if (!_currency) throw new Error("Money currency is required");
  }

  static from(amount: string | number, currency = "IDR"): Money {
    const parsed = typeof amount === "string" ? Number(amount) : amount;
    return new Money(parsed, currency);
  }

  static zero(currency = "IDR"): Money {
    return new Money(0, currency);
  }

  get amount(): number { return this._amount; }
  get currency(): string { return this._currency; }
  get value(): string { return this._amount.toFixed(2); }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount + other._amount, this._currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this._amount - other._amount, this._currency);
  }

  multiply(factor: number): Money {
    return new Money(this._amount * factor, this._currency);
  }

  isGreaterThan(other: Money): boolean {
    return this._amount > other._amount;
  }

  isLessThanOrEqual(other: Money): boolean {
    return this._amount <= other._amount;
  }

  toLocaleString(locale = "id-ID"): string {
    return new Intl.NumberFormat(locale, { style: "currency", currency: this._currency, minimumFractionDigits: 0 }).format(this._amount);
  }

  private assertSameCurrency(other: Money): void {
    if (this._currency !== other._currency) {
      throw new Error(`Cannot operate on different currencies: ${this._currency} vs ${other._currency}`);
    }
  }
}
