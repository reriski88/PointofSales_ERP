export function decimal(value: string | number): number {
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed;
}

export function fixed(value: number, digits = 2): string {
  return value.toFixed(digits);
}

export function baseQty(inputQty: number, factor: string | number): number {
  return inputQty * decimal(factor);
}
