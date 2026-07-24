import { env } from '@/lib/env';

// Kenyan VAT / tax computation for the invoices PaySwift issues to merchants
// (Stage F). PURE + config-driven so it is fully testable and flips from
// "interim" to "VAT invoice" via env alone.
//
// Amounts are whole KES (matching the rest of the billing model). The stored
// Invoice.amount is the TOTAL the merchant pays; when PaySwift is VAT-registered
// that total is treated as VAT-INCLUSIVE and split into net + 16% VAT, so the
// headline price the merchant agreed to never changes when VAT is switched on.

export const KENYA_VAT_RATE = 0.16;

export interface TaxBreakdown {
  /** Whole-KES amounts. total = net + vat. */
  net: number;
  vat: number;
  total: number;
  vatRate: number;
  /** true once PaySwift is VAT-registered (env-gated). */
  vatRegistered: boolean;
}

export function isPlatformVatRegistered(): boolean {
  return env.PLATFORM_VAT_REGISTERED === 'true';
}

export function platformKraPin(): string | null {
  return env.PLATFORM_KRA_PIN ?? null;
}

/**
 * Splits a VAT-INCLUSIVE total into net + VAT. When PaySwift is not yet
 * VAT-registered, VAT is 0 and net == total (an interim, non-tax invoice).
 */
export function computeTaxBreakdown(totalInclusive: number): TaxBreakdown {
  const vatRegistered = isPlatformVatRegistered();
  if (!vatRegistered) {
    return { net: totalInclusive, vat: 0, total: totalInclusive, vatRate: 0, vatRegistered: false };
  }
  // Back out the VAT component from a VAT-inclusive total, rounded to whole KES.
  const net = Math.round(totalInclusive / (1 + KENYA_VAT_RATE));
  const vat = totalInclusive - net;
  return { net, vat, total: totalInclusive, vatRate: KENYA_VAT_RATE, vatRegistered: true };
}
