import { StrictPrecisionEngine } from '../services/StrictPrecisionEngine';

/**
 * Currency and Financial Math formatting utilities
 * Powered by StrictPrecisionEngine (Epsilon Financial Rounding)
 */

export function formatMoney(amount: number, currency: string = 'ر.ي'): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return `0.00 ${currency}`;
  }
  // Format as beautifully readable currency string with "ر.ي" or "," commas
  const rounded = StrictPrecisionEngine.financialRound(amount, 2);
  return `${rounded.toLocaleString('ar-YE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

export function roundToTwoDecimals(val: number): number {
  return StrictPrecisionEngine.financialRound(val, 2);
}

export function financialRound(val: number | string | null | undefined, decimals: number = 2): number {
  return StrictPrecisionEngine.financialRound(val, decimals);
}

export function toSafeCurrency(val: number | string | null | undefined, currency: string = 'YER'): number {
  return StrictPrecisionEngine.toSafeCurrency(val, currency);
}

export function safeAdd(a: number | string, b: number | string, decimals: number = 4): number {
  return StrictPrecisionEngine.safeAdd(a, b, decimals);
}

export function safeSub(a: number | string, b: number | string, decimals: number = 4): number {
  return StrictPrecisionEngine.safeSub(a, b, decimals);
}

export function safeMul(a: number | string, b: number | string, decimals: number = 4): number {
  return StrictPrecisionEngine.safeMul(a, b, decimals);
}

export function safeDiv(num: number | string, den: number | string, decimals: number = 4): number {
  return StrictPrecisionEngine.safeDiv(num, den, decimals);
}

export function safeSum(numbers: (number | string | null | undefined)[], decimals: number = 2): number {
  return StrictPrecisionEngine.safeSum(numbers, decimals);
}

export function getCurrencySymbol(): string {
  return 'ر.ي';
}

export { StrictPrecisionEngine };
