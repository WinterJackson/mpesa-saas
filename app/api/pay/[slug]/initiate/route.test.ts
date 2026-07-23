import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { findActiveLinkBySlug } from '@/lib/repositories/payment-links';
import { createAndInitiatePayment } from '@/lib/payments';

vi.mock('@/lib/repositories/payment-links', () => ({ findActiveLinkBySlug: vi.fn() }));
vi.mock('@/lib/payments', () => ({ createAndInitiatePayment: vi.fn() }));

function makeRequest(body?: unknown) {
  return new Request('http://localhost/api/pay/abc/initiate', {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}
const ctx = { params: Promise.resolve({ slug: 'abc' }) };

const fixedLink = {
  id: 'pl-1',
  slug: 'abc',
  organizationId: 'org-1',
  amountType: 'fixed',
  amount: 2500,
  environment: 'sandbox',
  liveApprovedAt: null,
  title: 'Blue Shirt',
  merchant: { id: 'm-1', businessName: 'Acme', environment: 'sandbox' },
};

describe('POST /api/pay/[slug]/initiate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAndInitiatePayment).mockResolvedValue({
      success: true,
      transaction: { id: 'tx-1', status: 'pending' },
      checkoutRequestId: 'ws_CO_1',
      merchantRequestID: 'mr-1',
      customerMessage: 'Enter PIN',
    } as never);
  });

  it('returns 404 for an unknown/inactive/expired link', async () => {
    vi.mocked(findActiveLinkBySlug).mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ phone: '0712345678' }), ctx);
    expect(res.status).toBe(404);
    expect(createAndInitiatePayment).not.toHaveBeenCalled();
  });

  it('rejects an invalid phone number', async () => {
    vi.mocked(findActiveLinkBySlug).mockResolvedValueOnce(fixedLink as never);
    const res = await POST(makeRequest({ phone: '123' }), ctx);
    expect(res.status).toBe(400);
    expect(createAndInitiatePayment).not.toHaveBeenCalled();
  });

  it('ignores the client amount for a fixed link and uses the stored amount', async () => {
    vi.mocked(findActiveLinkBySlug).mockResolvedValueOnce(fixedLink as never);
    const res = await POST(makeRequest({ phone: '0712345678', amount: 999999 }), ctx);
    expect(res.status).toBe(201);
    expect(createAndInitiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2500, source: 'payment_link', paymentLinkId: 'pl-1' })
    );
  });

  it('requires a valid amount for a customer_set link', async () => {
    vi.mocked(findActiveLinkBySlug).mockResolvedValueOnce({
      ...fixedLink,
      amountType: 'customer_set',
      amount: null,
    } as never);
    const res = await POST(makeRequest({ phone: '0712345678' }), ctx);
    expect(res.status).toBe(400);
    expect(createAndInitiatePayment).not.toHaveBeenCalled();
  });

  it('uses the customer-supplied amount for a customer_set link', async () => {
    vi.mocked(findActiveLinkBySlug).mockResolvedValueOnce({
      ...fixedLink,
      amountType: 'customer_set',
      amount: null,
    } as never);
    const res = await POST(makeRequest({ phone: '0712345678', amount: 500 }), ctx);
    expect(res.status).toBe(201);
    expect(createAndInitiatePayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 500 }));
  });

  it('refuses a live link whose org is not yet go-live approved', async () => {
    vi.mocked(findActiveLinkBySlug).mockResolvedValueOnce({
      ...fixedLink,
      environment: 'live',
      liveApprovedAt: null,
    } as never);
    const res = await POST(makeRequest({ phone: '0712345678' }), ctx);
    expect(res.status).toBe(403);
    expect(createAndInitiatePayment).not.toHaveBeenCalled();
  });

  it('returns 201 with the transaction id and checkout request id on success', async () => {
    vi.mocked(findActiveLinkBySlug).mockResolvedValueOnce(fixedLink as never);
    const res = await POST(makeRequest({ phone: '0712345678' }), ctx);
    const data = await res.json();
    expect(data.data.transactionId).toBe('tx-1');
    expect(data.data.checkoutRequestId).toBe('ws_CO_1');
  });
});
