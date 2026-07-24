import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/repositories/billing', () => ({
  attachInvoiceCharge: vi.fn(),
  markInvoiceChargeFailed: vi.fn(),
  listInvoicesForDunning: vi.fn(),
  setSubscriptionStatus: vi.fn(),
}));
vi.mock('@/lib/billing/platform-mpesa', () => ({
  initiateBillingStkPush: vi.fn(),
  isPlatformBillingConfigured: vi.fn(),
}));
vi.mock('@/lib/email/notifications', () => ({ notifySubscriptionSuspended: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { chargeInvoice, runDunningCycle } from './subscription-billing';
import {
  attachInvoiceCharge,
  markInvoiceChargeFailed,
  listInvoicesForDunning,
  setSubscriptionStatus,
} from '@/lib/repositories/billing';
import { initiateBillingStkPush, isPlatformBillingConfigured } from '@/lib/billing/platform-mpesa';
import { notifySubscriptionSuspended } from '@/lib/email/notifications';
import { DUNNING } from './dunning';

const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isPlatformBillingConfigured).mockReturnValue(true);
});

describe('chargeInvoice (never throws — returns typed reasons)', () => {
  it('skips when the org has no billing M-Pesa number', async () => {
    const res = await chargeInvoice({ id: 'inv-1', amount: 2900, subscription: { organization: { billingMpesaPhone: null } } });
    expect(res).toEqual({ charged: false, reason: 'no_billing_phone' });
    expect(initiateBillingStkPush).not.toHaveBeenCalled();
  });

  it('skips when the platform billing collector is unconfigured', async () => {
    vi.mocked(isPlatformBillingConfigured).mockReturnValue(false);
    const res = await chargeInvoice({ id: 'inv-1', amount: 2900, subscription: { organization: { billingMpesaPhone: '254712345678' } } });
    expect(res).toEqual({ charged: false, reason: 'platform_unconfigured' });
  });

  it('sends the STK and records the checkout id on success', async () => {
    vi.mocked(initiateBillingStkPush).mockResolvedValueOnce({ checkoutRequestId: 'ws_CO_9', merchantRequestId: 'm', customerMessage: '', isSandboxFallback: true });
    vi.mocked(attachInvoiceCharge).mockResolvedValueOnce(1);
    const res = await chargeInvoice({ id: 'inv-1', amount: 2900, subscription: { organization: { billingMpesaPhone: '254712345678' } } });
    expect(res).toEqual({ charged: true, checkoutRequestId: 'ws_CO_9' });
    expect(attachInvoiceCharge).toHaveBeenCalledWith('inv-1', 'ws_CO_9');
  });

  it('marks the invoice failed (for later retry) when the gateway throws', async () => {
    vi.mocked(initiateBillingStkPush).mockRejectedValueOnce(new Error('gateway down'));
    const res = await chargeInvoice({ id: 'inv-1', amount: 2900, subscription: { organization: { billingMpesaPhone: '254712345678' } } });
    expect(res).toEqual({ charged: false, reason: 'stk_error' });
    expect(markInvoiceChargeFailed).toHaveBeenCalledWith('inv-1', 'gateway down');
  });
});

describe('runDunningCycle', () => {
  it('suspends a subscription whose grace window elapsed with retries exhausted', async () => {
    const now = new Date('2026-07-24T12:00:00.000Z');
    vi.mocked(listInvoicesForDunning).mockResolvedValueOnce([
      {
        id: 'inv-1',
        amount: 2900,
        status: 'failed',
        attemptCount: DUNNING.MAX_ATTEMPTS,
        lastAttemptAt: new Date(now.getTime() - 2 * HOUR),
        subscription: {
          id: 'sub-1',
          organizationId: 'org-1',
          status: 'past_due',
          gracePeriodEnd: new Date(now.getTime() - HOUR),
          organization: { billingMpesaPhone: '254712345678' },
        },
      },
    ] as never);

    const summary = await runDunningCycle(now);
    expect(setSubscriptionStatus).toHaveBeenCalledWith('sub-1', 'suspended');
    expect(notifySubscriptionSuspended).toHaveBeenCalledWith('org-1', 2900);
    expect(summary.suspended).toBe(1);
    expect(initiateBillingStkPush).not.toHaveBeenCalled();
  });

  it('retries a due failed invoice within the grace window', async () => {
    const now = new Date('2026-07-24T12:00:00.000Z');
    vi.mocked(initiateBillingStkPush).mockResolvedValueOnce({ checkoutRequestId: 'ws_CO_1', merchantRequestId: 'm', customerMessage: '', isSandboxFallback: true });
    vi.mocked(attachInvoiceCharge).mockResolvedValueOnce(1);
    vi.mocked(listInvoicesForDunning).mockResolvedValueOnce([
      {
        id: 'inv-1',
        amount: 2900,
        status: 'failed',
        attemptCount: 1,
        lastAttemptAt: new Date(now.getTime() - DUNNING.RETRY_INTERVAL_MS - HOUR),
        subscription: {
          id: 'sub-1',
          organizationId: 'org-1',
          status: 'past_due',
          gracePeriodEnd: new Date(now.getTime() + 3 * 24 * HOUR),
          organization: { billingMpesaPhone: '254712345678' },
        },
      },
    ] as never);

    const summary = await runDunningCycle(now);
    expect(initiateBillingStkPush).toHaveBeenCalled();
    expect(summary.charged).toBe(1);
    expect(setSubscriptionStatus).not.toHaveBeenCalled();
  });
});
