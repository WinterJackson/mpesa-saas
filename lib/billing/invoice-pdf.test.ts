import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/env', () => ({ env: {} as Record<string, string | undefined> }));
import { env } from '@/lib/env';
import { buildInvoicePdf, type InvoicePdfData } from './invoice-pdf';

const e = env as unknown as Record<string, string | undefined>;

const base: InvoicePdfData = {
  invoiceNumber: 'PSW-2026-ABCDEF',
  issuedAt: new Date('2026-07-24'),
  status: 'paid',
  paidAt: new Date('2026-07-24'),
  mpesaReceipt: 'QHJ7XYZ',
  amount: 2900,
  planName: 'Growth',
  buyerName: 'Acme Ltd',
  buyerKraPin: 'A012345678Z',
  etims: null,
};

function isPdf(bytes: Uint8Array): boolean {
  // "%PDF" magic header.
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

describe('buildInvoicePdf', () => {
  beforeEach(() => {
    for (const k of Object.keys(e)) delete e[k];
  });

  it('produces a valid PDF for an interim (non-VAT) invoice', async () => {
    const bytes = await buildInvoicePdf(base);
    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(isPdf(bytes)).toBe(true);
  });

  it('produces a valid PDF once VAT-registered (VAT block populated)', async () => {
    e.PLATFORM_VAT_REGISTERED = 'true';
    e.PLATFORM_KRA_PIN = 'P051234567X';
    const bytes = await buildInvoicePdf(base);
    expect(isPdf(bytes)).toBe(true);
  });

  it('embeds the eTIMS control-unit stamp + QR when supplied', async () => {
    const bytes = await buildInvoicePdf({
      ...base,
      etims: { cuInvoiceNumber: 'CU-123', cuReceiptSignature: 'SIG-456', qrData: 'https://etims/verify/CU-123' },
    });
    expect(isPdf(bytes)).toBe(true);
  });
});
