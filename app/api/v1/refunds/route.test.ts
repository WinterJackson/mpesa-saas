import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { authenticateApiKey } from '@/lib/auth';
import { findTransactionById } from '@/lib/repositories/transactions';
import { createAndInitiateRefund } from '@/lib/payouts';
import { writeAuditLog } from '@/lib/repositories/audit-log';

vi.mock('@/lib/auth', () => ({ authenticateApiKey: vi.fn() }));
vi.mock('@/lib/repositories/transactions', () => ({ findTransactionById: vi.fn() }));
vi.mock('@/lib/payouts', () => ({ createAndInitiateRefund: vi.fn() }));
vi.mock('@/lib/idempotency', () => ({
  getCachedIdempotentResponse: vi.fn().mockResolvedValue(null),
  cacheIdempotentResponse: vi.fn(),
}));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/v1/refunds', { method: 'POST', body: JSON.stringify(body) });
}

const authOk = {
  success: true as const,
  organizationId: 'org-1',
  merchant: { id: 'm-1', environment: 'sandbox' } as never,
  apiKey: { id: 'key-1', scope: 'read_write' } as never,
};

const completedTx = { id: 'tx-1', status: 'completed', amount: 1000, phone: '254712345678' };

describe('POST /api/v1/refunds', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a read_only key with 403', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce({ ...authOk, apiKey: { id: 'key-1', scope: 'read_only' } as never });
    const res = await POST(makeRequest({ transactionId: 'tx-1' }));
    expect(res.status).toBe(403);
  });

  it('404s an unknown / cross-tenant transaction', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce(authOk);
    vi.mocked(findTransactionById).mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ transactionId: 'tx-x' }));
    expect(findTransactionById).toHaveBeenCalledWith('org-1', 'tx-x');
    expect(res.status).toBe(404);
  });

  it('400s a non-completed transaction', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce(authOk);
    vi.mocked(findTransactionById).mockResolvedValueOnce({ ...completedTx, status: 'pending' } as never);
    const res = await POST(makeRequest({ transactionId: 'tx-1' }));
    expect(res.status).toBe(400);
  });

  it('400s when refund amount exceeds the original', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce(authOk);
    vi.mocked(findTransactionById).mockResolvedValueOnce(completedTx as never);
    const res = await POST(makeRequest({ transactionId: 'tx-1', amount: 5000 }));
    expect(res.status).toBe(400);
  });

  it('defaults to a full refund and returns 201', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce(authOk);
    vi.mocked(findTransactionById).mockResolvedValueOnce(completedTx as never);
    vi.mocked(createAndInitiateRefund).mockResolvedValueOnce({
      success: true, refundId: 'r-1', conversationId: 'AG_2', originatorConversationId: 'OC_2',
    });

    const res = await POST(makeRequest({ transactionId: 'tx-1' }));
    const data = await res.json();

    expect(createAndInitiateRefund).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1', transactionId: 'tx-1', amount: 1000, phone: '254712345678',
    }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'refund.initiated' }));
    expect(res.status).toBe(201);
    expect(data.data.refundId).toBe('r-1');
  });
});
