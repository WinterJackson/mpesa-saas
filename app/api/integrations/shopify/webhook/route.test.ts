import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { prisma } from '@/lib/db';
import { verifyShopifyWebhook } from '@/lib/shopify';
import { createAndInitiatePayment } from '@/lib/payments';

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    // Run the fire-and-forget callback synchronously so tests can assert on it.
    after: (cb: () => unknown) => cb(),
  };
});

vi.mock('@/lib/db', () => ({
  prisma: { merchant: { findFirst: vi.fn() } },
}));
vi.mock('@/lib/shopify', () => ({ verifyShopifyWebhook: vi.fn() }));
vi.mock('@/lib/crypto', () => ({ decryptSecret: vi.fn((v: string) => v) }));
vi.mock('@/lib/payments', () => ({ createAndInitiatePayment: vi.fn() }));

function makeRequest(body: object, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/integrations/shopify/webhook', {
    method: 'POST',
    headers: {
      'x-shopify-hmac-sha256': 'sig',
      'x-shopify-shop-domain': 'acme.myshopify.com',
      'x-shopify-topic': 'orders/create',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const ORDER = { id: 999, name: '#1001', currency: 'KES', total_price: '100.00', phone: '254712345678' };

describe('POST /api/integrations/shopify/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when no merchant matches the shop domain', async () => {
    vi.mocked(prisma.merchant.findFirst).mockResolvedValueOnce(null);
    const response = await POST(makeRequest(ORDER));
    expect(response.status).toBe(404);
  });

  it('returns 500 with a clear message when the merchant has no organizationId yet', async () => {
    vi.mocked(prisma.merchant.findFirst).mockResolvedValueOnce({
      id: 'merchant-1',
      organizationId: null,
      shopifyWebhookSecret: 'secret',
    } as never);

    const response = await POST(makeRequest(ORDER));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toMatch(/account setup incomplete/i);
    expect(verifyShopifyWebhook).not.toHaveBeenCalled();
  });

  it('passes the merchant organizationId through to createAndInitiatePayment for a valid order', async () => {
    vi.mocked(prisma.merchant.findFirst).mockResolvedValueOnce({
      id: 'merchant-1',
      organizationId: 'org-1',
      shopifyWebhookSecret: 'secret',
    } as never);
    vi.mocked(verifyShopifyWebhook).mockReturnValueOnce(true);
    vi.mocked(createAndInitiatePayment).mockResolvedValueOnce({
      success: true,
      transaction: {} as never,
      checkoutRequestId: 'ws_1',
      merchantRequestID: 'm_1',
      customerMessage: 'Success',
    });

    const response = await POST(makeRequest(ORDER));
    expect(response.status).toBe(200);
    expect(createAndInitiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' })
    );
  });
});
