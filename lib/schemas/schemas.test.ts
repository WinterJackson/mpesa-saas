import { describe, it, expect } from 'vitest';
import { parseWith } from './common';
import { paymentInitiateRequestSchema } from './payments';
import { payoutCreateRequestSchema } from './payouts';
import { refundCreateRequestSchema } from './refunds';
import { payLinkInitiateRequestSchema } from './pay';

describe('paymentInitiateRequestSchema', () => {
  it('normalizes phone and amount and truncates orderReference', () => {
    const r = parseWith(paymentInitiateRequestSchema, {
      phone: '0712345678',
      amount: 2500,
      orderReference: 'x'.repeat(80),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.phone).toBe('254712345678');
      expect(r.data.amount).toBe(2500);
      expect(r.data.orderReference).toHaveLength(50);
    }
  });

  it('rejects an invalid phone with the validator message', () => {
    const r = parseWith(paymentInitiateRequestSchema, { phone: '123', amount: 2500 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/phone/i);
  });

  it('rejects a non-integer amount', () => {
    const r = parseWith(paymentInitiateRequestSchema, { phone: '0712345678', amount: 25.5 });
    expect(r.ok).toBe(false);
  });

  it('rejects an amount over the M-Pesa limit', () => {
    const r = parseWith(paymentInitiateRequestSchema, { phone: '0712345678', amount: 200000 });
    expect(r.ok).toBe(false);
  });
});

describe('payoutCreateRequestSchema', () => {
  it('accepts a valid payout with a known commandId', () => {
    const r = parseWith(payoutCreateRequestSchema, {
      phone: '254712345678',
      amount: 100,
      commandId: 'SalaryPayment',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects an unknown commandId', () => {
    const r = parseWith(payoutCreateRequestSchema, {
      phone: '254712345678',
      amount: 100,
      commandId: 'NotACommand',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/commandId/);
  });
});

describe('refundCreateRequestSchema', () => {
  it('requires a transactionId', () => {
    const r = parseWith(refundCreateRequestSchema, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/transactionId/);
  });

  it('accepts an optional partial amount', () => {
    const r = parseWith(refundCreateRequestSchema, { transactionId: 'tx-1', amount: 50 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.amount).toBe(50);
  });
});

describe('payLinkInitiateRequestSchema', () => {
  it('allows a missing amount (customer_set links resolve it in the route)', () => {
    const r = parseWith(payLinkInitiateRequestSchema, { phone: '0712345678' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.amount).toBeUndefined();
  });

  it('accepts a loosely-typed amount (range-checked in the route by link type)', () => {
    const r = parseWith(payLinkInitiateRequestSchema, { phone: '0712345678', amount: 500 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.amount).toBe(500);
  });

  it('still rejects an invalid phone', () => {
    const r = parseWith(payLinkInitiateRequestSchema, { phone: 'nope', amount: 500 });
    expect(r.ok).toBe(false);
  });
});
