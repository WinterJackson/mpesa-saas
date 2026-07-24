import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
import { getEtimsProvider, tryRegisterWithEtims } from './etims';

const input = {
  invoiceId: 'inv-1',
  totalKes: 2900,
  vatKes: 0,
  buyerName: 'Acme',
  buyerKraPin: null,
  issuedAt: new Date('2026-07-24'),
};

describe('eTIMS provider seam', () => {
  it('defaults to the Null provider (no fabricated CU number while not VAT-registered)', async () => {
    expect(getEtimsProvider().name).toBe('none');
    expect(await getEtimsProvider().registerInvoice(input)).toBeNull();
  });

  it('tryRegisterWithEtims is fail-safe and returns null', async () => {
    expect(await tryRegisterWithEtims(input)).toBeNull();
  });
});
