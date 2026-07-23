import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { listTransactionsPage, transactionStatusSummary } from '@/lib/repositories/transactions';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/repositories/organizations', () => ({
  getOrganizationContext: vi.fn(),
}));

vi.mock('@/lib/repositories/transactions', () => ({
  listTransactionsPage: vi.fn(),
  transactionStatusSummary: vi.fn(),
  summarizeStats: vi.fn(() => ({
    totalTransactions: 0,
    totalRevenue: 0,
    successRate: 0,
    pendingCount: 0,
  })),
}));

describe('GET /api/merchant/transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: null, orgId: null } as never);
    const response = await GET(new Request('http://localhost/api/merchant/transactions'));
    expect(response.status).toBe(401);
    expect(getOrganizationContext).not.toHaveBeenCalled();
  });

  it('returns 404 when the signed-in user has no Organization', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1', orgId: null } as never);
    vi.mocked(getOrganizationContext).mockResolvedValueOnce(null);

    const response = await GET(new Request('http://localhost/api/merchant/transactions'));
    expect(response.status).toBe(404);
  });

  it('resolves the org via Clerk auth() and scopes both repository calls to it', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1', orgId: 'clerk-org-1' } as never);
    vi.mocked(getOrganizationContext).mockResolvedValueOnce({
      organization: { id: 'org-1' },
      membership: {},
      merchant: null,
    } as never);
    vi.mocked(listTransactionsPage).mockResolvedValueOnce({ data: [], nextCursor: null });
    vi.mocked(transactionStatusSummary).mockResolvedValueOnce([]);

    const response = await GET(new Request('http://localhost/api/merchant/transactions?limit=10'));

    expect(getOrganizationContext).toHaveBeenCalledWith('user-1', 'clerk-org-1');
    expect(listTransactionsPage).toHaveBeenCalledWith('org-1', expect.objectContaining({ limit: 10 }));
    expect(transactionStatusSummary).toHaveBeenCalledWith('org-1');
    expect(response.status).toBe(200);
  });

  it('skips the summary on a cursor (subsequent) page', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ userId: 'user-1', orgId: 'clerk-org-1' } as never);
    vi.mocked(getOrganizationContext).mockResolvedValueOnce({
      organization: { id: 'org-1' },
      membership: {},
      merchant: null,
    } as never);
    vi.mocked(listTransactionsPage).mockResolvedValueOnce({ data: [], nextCursor: 'c2' });

    const response = await GET(new Request('http://localhost/api/merchant/transactions?cursor=c1'));
    const json = await response.json();

    expect(transactionStatusSummary).not.toHaveBeenCalled();
    expect(json.data.nextCursor).toBe('c2');
  });
});
