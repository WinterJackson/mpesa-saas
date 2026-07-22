import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { authenticateApiKey } from '@/lib/auth';
import { findTransactionById } from '@/lib/repositories/transactions';

vi.mock('@/lib/auth', () => ({
  authenticateApiKey: vi.fn(),
}));

vi.mock('@/lib/repositories/transactions', () => ({
  findTransactionById: vi.fn(),
}));

function makeRequest(id: string) {
  return {
    request: new Request(`http://localhost/api/v1/payments/status/${id}`),
    context: { params: Promise.resolve({ id }) },
  };
}

describe('GET /api/v1/payments/status/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the auth error/status when authentication fails', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce({
      success: false,
      error: 'Invalid API key',
      status: 401,
    });

    const { request, context } = makeRequest('tx_1');
    const response = await GET(request, context);
    expect(response.status).toBe(401);
    expect(findTransactionById).not.toHaveBeenCalled();
  });

  it('scopes the lookup to the authenticated organizationId, not merchantId', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce({
      success: true,
      organizationId: 'org-1',
      merchant: { id: 'merchant-1' } as never,
      apiKey: {} as never,
    });
    vi.mocked(findTransactionById).mockResolvedValueOnce(null);

    const { request, context } = makeRequest('tx_1');
    await GET(request, context);

    expect(findTransactionById).toHaveBeenCalledWith('org-1', 'tx_1');
  });

  it('returns 404 (not 403) when the transaction belongs to a different organization', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce({
      success: true,
      organizationId: 'org-1',
      merchant: { id: 'merchant-1' } as never,
      apiKey: {} as never,
    });
    // findTransactionById is itself organizationId-scoped, so a cross-tenant
    // transaction simply resolves to null rather than an ownership mismatch.
    vi.mocked(findTransactionById).mockResolvedValueOnce(null);

    const { request, context } = makeRequest('tx_owned_by_someone_else');
    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
  });

  it('returns the transaction for the authenticated organization', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce({
      success: true,
      organizationId: 'org-1',
      merchant: { id: 'merchant-1' } as never,
      apiKey: {} as never,
    });
    vi.mocked(findTransactionById).mockResolvedValueOnce({
      id: 'tx_1',
      merchantId: 'merchant-1',
      amount: 100,
      phone: '254712345678',
      status: 'completed',
      orderReference: null,
      environment: 'sandbox',
      source: 'api',
      checkoutRequestId: 'ws_123',
      mpesaReceipt: 'ABC123',
      resultCode: 0,
      resultDesc: 'Success',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { request, context } = makeRequest('tx_1');
    const response = await GET(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.status).toBe('completed');
  });
});
