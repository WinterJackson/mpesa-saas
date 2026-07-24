import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: {} as Record<string, string | undefined> }));
import { env } from '@/lib/env';
import { computeTaxBreakdown, isPlatformVatRegistered, KENYA_VAT_RATE } from './tax';

const e = env as unknown as Record<string, string | undefined>;

describe('computeTaxBreakdown', () => {
  beforeEach(() => {
    for (const k of Object.keys(e)) delete e[k];
  });

  it('interim (not VAT-registered): VAT is 0 and net equals the total', () => {
    const b = computeTaxBreakdown(2900);
    expect(b.vatRegistered).toBe(false);
    expect(b).toMatchObject({ net: 2900, vat: 0, total: 2900, vatRate: 0 });
    expect(isPlatformVatRegistered()).toBe(false);
  });

  it('VAT-registered: backs 16% VAT out of a VAT-inclusive total (net + vat = total)', () => {
    e.PLATFORM_VAT_REGISTERED = 'true';
    const b = computeTaxBreakdown(2900);
    expect(b.vatRegistered).toBe(true);
    expect(b.vatRate).toBe(KENYA_VAT_RATE);
    expect(b.net).toBe(2500); // round(2900 / 1.16)
    expect(b.vat).toBe(400); // 2900 - 2500
    expect(b.net + b.vat).toBe(b.total);
  });
});
