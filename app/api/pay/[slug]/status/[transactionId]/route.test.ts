import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { findLinkTransactionStatus } from '@/lib/repositories/payment-links';

vi.mock('@/lib/repositories/payment-links', () => ({ findLinkTransactionStatus: vi.fn() }));

const ctx = { params: Promise.resolve({ slug: 'abc', transactionId: 'tx-1' }) };

describe('GET /api/pay/[slug]/status/[transactionId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when the transaction is not tied to the link', async () => {
    vi.mocked(findLinkTransactionStatus).mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost'), ctx);
    expect(res.status).toBe(404);
  });

  it('returns the scoped status payload', async () => {
    vi.mocked(findLinkTransactionStatus).mockResolvedValueOnce({
      transactionId: 'tx-1',
      status: 'completed',
      mpesaReceipt: 'ABC123',
      resultDesc: null,
    });
    const res = await GET(new Request('http://localhost'), ctx);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.status).toBe('completed');
    expect(data.data.mpesaReceipt).toBe('ABC123');
    expect(findLinkTransactionStatus).toHaveBeenCalledWith('abc', 'tx-1');
  });
});
