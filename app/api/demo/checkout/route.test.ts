import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { createAndInitiatePayment } from '@/lib/payments';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: { merchant: { findUnique: vi.fn() } },
}));
vi.mock('@/lib/payments', () => ({ createAndInitiatePayment: vi.fn() }));

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/demo/checkout', { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/demo/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
  });

  it('returns 500 with a clear message when the resolved merchant has no organizationId yet', async () => {
    vi.mocked(prisma.merchant.findUnique).mockResolvedValueOnce({
      id: 'merchant_demo',
      organizationId: null,
      environment: 'sandbox',
      businessName: 'Demo',
    } as never);

    const response = await POST(makeRequest({ phone: '254712345678', amount: 100 }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toMatch(/account setup incomplete/i);
    expect(createAndInitiatePayment).not.toHaveBeenCalled();
  });

  it('passes the merchant organizationId through to createAndInitiatePayment once backfilled', async () => {
    vi.mocked(prisma.merchant.findUnique).mockResolvedValueOnce({
      id: 'merchant_demo',
      organizationId: 'org-1',
      environment: 'sandbox',
      businessName: 'Demo',
    } as never);
    vi.mocked(createAndInitiatePayment).mockResolvedValueOnce({
      success: true,
      transaction: {} as never,
      checkoutRequestId: 'ws_1',
      merchantRequestID: 'm_1',
      customerMessage: 'Success',
    });

    const response = await POST(makeRequest({ phone: '254712345678', amount: 100 }));
    expect(response.status).toBe(201);
    expect(createAndInitiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' })
    );
  });
});
