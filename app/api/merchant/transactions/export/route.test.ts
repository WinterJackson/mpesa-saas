import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { listTransactionsForExport } from '@/lib/repositories/transactions';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({ getOrganizationContext: vi.fn() }));
vi.mock('@/lib/repositories/transactions', () => ({ listTransactionsForExport: vi.fn() }));

function makeRequest(query = '') {
  return new Request(`http://localhost/api/merchant/transactions/export${query}`);
}

describe('GET /api/merchant/transactions/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1', orgId: null } as never);
    vi.mocked(getOrganizationContext).mockResolvedValue({ organization: { id: 'org-1' }, membership: { role: 'finance' }, merchant: {} } as never);
  });

  it('401s when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null, orgId: null } as never);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns a CSV attachment with a header row and escaped fields', async () => {
    vi.mocked(listTransactionsForExport).mockResolvedValueOnce([
      { id: 't1', amount: 1500, phone: '254712345678', status: 'completed', orderReference: 'ORD, 1', environment: 'sandbox', source: 'stk', createdAt: new Date('2026-07-01T10:00:00Z'), updatedAt: new Date(), mpesaReceipt: 'QHJ1' },
    ] as never);

    const res = await GET(makeRequest('?environment=sandbox'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');

    const body = await res.text();
    expect(body).toContain('Date,Status,Amount (KES),Phone,Reference,M-Pesa Receipt,Source,Environment');
    // Comma in the reference is quoted per RFC-4180.
    expect(body).toContain('"ORD, 1"');
    expect(body).toContain('254712345678');
    // Only the sandbox filter is forwarded to the repository.
    expect(listTransactionsForExport).toHaveBeenCalledWith('org-1', { environment: 'sandbox', status: undefined });
  });
});
