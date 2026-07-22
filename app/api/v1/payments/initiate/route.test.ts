import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { authenticateApiKey } from '@/lib/auth';
import { createAndInitiatePayment } from '@/lib/payments';

vi.mock('@/lib/auth', () => ({
  authenticateApiKey: vi.fn(),
}));

vi.mock('@/lib/payments', () => ({
  createAndInitiatePayment: vi.fn(),
}));

vi.mock('@/lib/idempotency', () => ({
  getCachedIdempotentResponse: vi.fn().mockResolvedValue(null),
  cacheIdempotentResponse: vi.fn(),
}));

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/v1/payments/initiate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/payments/initiate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the auth error/status when authentication fails', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce({
      success: false,
      error: 'Invalid API key',
      status: 401,
    });

    const response = await POST(makeRequest({ phone: '254712345678', amount: 100 }));
    expect(response.status).toBe(401);
    expect(createAndInitiatePayment).not.toHaveBeenCalled();
  });

  it('rejects a read_only-scoped key with 403 rather than initiating a payment', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce({
      success: true,
      organizationId: 'org-1',
      merchant: { id: 'merchant-1', businessName: 'Acme', environment: 'sandbox' } as never,
      apiKey: { id: 'key-1', scope: 'read_only' } as never,
    });

    const response = await POST(makeRequest({ phone: '254712345678', amount: 100 }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/read-only/i);
    expect(createAndInitiatePayment).not.toHaveBeenCalled();
  });

  it('allows a read_write-scoped key to initiate a payment', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce({
      success: true,
      organizationId: 'org-1',
      merchant: { id: 'merchant-1', businessName: 'Acme', environment: 'sandbox' } as never,
      apiKey: { id: 'key-1', scope: 'read_write' } as never,
    });
    vi.mocked(createAndInitiatePayment).mockResolvedValueOnce({
      success: true,
      transaction: { id: 'tx-1' } as never,
      checkoutRequestId: 'ws_123',
      merchantRequestID: 'm-1',
      customerMessage: 'Success',
    });

    const response = await POST(makeRequest({ phone: '254712345678', amount: 100 }));
    expect(response.status).toBe(201);
    expect(createAndInitiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1' })
    );
  });
});
