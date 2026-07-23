import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { findOrgContextByShortcode } from '@/lib/repositories/daraja-credentials';
import { createC2BTransactionIfNew } from '@/lib/repositories/transactions';
import { finalizeTransactionAsync } from '@/lib/transaction-finalization';

vi.mock('@/lib/repositories/daraja-credentials', () => ({ findOrgContextByShortcode: vi.fn() }));
vi.mock('@/lib/repositories/transactions', () => ({ createC2BTransactionIfNew: vi.fn() }));
vi.mock('@/lib/transaction-finalization', () => ({ finalizeTransactionAsync: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function c2bRequest(body: unknown) {
  return new Request('http://localhost/api/mpesa/c2b/confirmation', { method: 'POST', body: JSON.stringify(body) });
}

const PAYLOAD = {
  TransID: 'RKT123',
  TransAmount: '150',
  BusinessShortCode: '600100',
  BillRefNumber: 'ORDER-9',
  MSISDN: '254712345678',
};

describe('POST /api/mpesa/c2b/confirmation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('accepts (ResultCode 0) even for an unparseable body', async () => {
    const res = await POST(new Request('http://localhost', { method: 'POST', body: 'x' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ResultCode).toBe(0);
  });

  it('skips when no org owns the shortcode', async () => {
    vi.mocked(findOrgContextByShortcode).mockResolvedValueOnce(null);
    const res = await POST(c2bRequest(PAYLOAD));
    expect(res.status).toBe(200);
    expect(createC2BTransactionIfNew).not.toHaveBeenCalled();
  });

  it('records a completed C2B transaction and fires finalization', async () => {
    vi.mocked(findOrgContextByShortcode).mockResolvedValueOnce({ organizationId: 'org-1', merchantId: 'm-1', environment: 'live' });
    vi.mocked(createC2BTransactionIfNew).mockResolvedValueOnce({ id: 'tx-c2b', merchant: { id: 'm-1' } } as never);

    const res = await POST(c2bRequest(PAYLOAD));
    expect(createC2BTransactionIfNew).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1', merchantId: 'm-1', mpesaReceipt: 'RKT123', amount: 150, orderReference: 'ORDER-9',
    }));
    expect(finalizeTransactionAsync).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('is idempotent — a duplicate receipt does not re-finalize', async () => {
    vi.mocked(findOrgContextByShortcode).mockResolvedValueOnce({ organizationId: 'org-1', merchantId: 'm-1', environment: 'live' });
    vi.mocked(createC2BTransactionIfNew).mockResolvedValueOnce(null);
    await POST(c2bRequest(PAYLOAD));
    expect(finalizeTransactionAsync).not.toHaveBeenCalled();
  });
});
