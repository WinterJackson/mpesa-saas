import { describe, it, expect, vi, beforeEach } from 'vitest';

// Real next/server after() throws outside a request scope; stub it.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: () => {},
}));
import { POST } from './route';
import {
  findInvoiceByCheckoutRequestId,
  markInvoicePaidViaMpesa,
  markInvoiceChargeFailed,
  setSubscriptionStatus,
} from '@/lib/repositories/billing';

vi.mock('@/lib/repositories/billing', () => ({
  findInvoiceByCheckoutRequestId: vi.fn(),
  markInvoicePaidViaMpesa: vi.fn(),
  markInvoiceChargeFailed: vi.fn(),
  setSubscriptionStatus: vi.fn(),
}));

vi.mock('@/lib/email/notifications', () => ({
  notifyInvoicePaid: vi.fn(),
  notifyInvoicePaymentFailed: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

function callback(body: unknown) {
  return new Request('http://localhost/api/mpesa/billing/callback', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function stk(checkoutId: string, resultCode: number, receipt?: string) {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: 'm-1',
        CheckoutRequestID: checkoutId,
        ResultCode: resultCode,
        ResultDesc: resultCode === 0 ? 'Success' : 'Request cancelled by user',
        ...(receipt
          ? { CallbackMetadata: { Item: [{ Name: 'MpesaReceiptNumber', Value: receipt }] } }
          : {}),
      },
    },
  };
}

const activeInvoice = {
  id: 'inv-1',
  amount: 2900,
  status: 'processing',
  attemptCount: 1,
  subscription: { id: 'sub-1', organizationId: 'org-1', status: 'active', gracePeriodEnd: null },
};

describe('POST /api/mpesa/billing/callback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('always returns 200 even for an unknown CheckoutRequestID (no retry storm)', async () => {
    vi.mocked(findInvoiceByCheckoutRequestId).mockResolvedValueOnce(null as never);
    const res = await POST(callback(stk('unknown', 0)));
    expect(res.status).toBe(200);
    expect(markInvoicePaidViaMpesa).not.toHaveBeenCalled();
  });

  it('marks the invoice paid and reactivates the subscription on ResultCode 0', async () => {
    vi.mocked(findInvoiceByCheckoutRequestId).mockResolvedValueOnce(activeInvoice as never);
    const res = await POST(callback(stk('ws_CO_1', 0, 'QHJ7XYZ')));
    expect(res.status).toBe(200);
    expect(markInvoicePaidViaMpesa).toHaveBeenCalledWith('inv-1', 'QHJ7XYZ');
    expect(setSubscriptionStatus).toHaveBeenCalledWith('sub-1', 'active', null);
    expect(markInvoiceChargeFailed).not.toHaveBeenCalled();
  });

  it('marks the attempt failed and moves an active subscription to past_due with a grace window on non-zero', async () => {
    vi.mocked(findInvoiceByCheckoutRequestId).mockResolvedValueOnce(activeInvoice as never);
    const res = await POST(callback(stk('ws_CO_2', 1032)));
    expect(res.status).toBe(200);
    expect(markInvoiceChargeFailed).toHaveBeenCalledWith('inv-1', 'Request cancelled by user');
    const call = vi.mocked(setSubscriptionStatus).mock.calls[0];
    expect(call[0]).toBe('sub-1');
    expect(call[1]).toBe('past_due');
    expect(call[2]).toBeInstanceOf(Date);
    expect(markInvoicePaidViaMpesa).not.toHaveBeenCalled();
  });

  it('is idempotent: a duplicate callback for an already-paid invoice does nothing', async () => {
    vi.mocked(findInvoiceByCheckoutRequestId).mockResolvedValueOnce({
      ...activeInvoice,
      status: 'paid',
    } as never);
    const res = await POST(callback(stk('ws_CO_1', 0, 'QHJ7XYZ')));
    expect(res.status).toBe(200);
    expect(markInvoicePaidViaMpesa).not.toHaveBeenCalled();
    expect(setSubscriptionStatus).not.toHaveBeenCalled();
  });
});
