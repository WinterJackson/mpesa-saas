import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { authenticateApiKey } from '@/lib/auth';
import { listTransactionsPage } from '@/lib/repositories/transactions';

vi.mock('@/lib/auth', () => ({ authenticateApiKey: vi.fn() }));
vi.mock('@/lib/repositories/transactions', () => ({ listTransactionsPage: vi.fn() }));

function req(qs = '') {
  return new Request(`http://localhost/api/v1/transactions${qs}`);
}

describe('GET /api/v1/transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateApiKey).mockResolvedValue({
      success: true,
      organizationId: 'org-1',
      merchant: { id: 'm-1' },
      apiKey: { id: 'k-1', scope: 'read_write' },
    } as never);
    vi.mocked(listTransactionsPage).mockResolvedValue({ data: [], nextCursor: null });
  });

  it('401s without a valid API key', async () => {
    vi.mocked(authenticateApiKey).mockResolvedValueOnce({ success: false, error: 'Invalid API key', status: 401 } as never);
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('scopes the list to the org and passes cursor/limit/filters through', async () => {
    const res = await GET(req('?cursor=abc&limit=10&status=completed&environment=live'));
    expect(res.status).toBe(200);
    expect(listTransactionsPage).toHaveBeenCalledWith('org-1', {
      cursor: 'abc',
      limit: 10,
      status: 'completed',
      environment: 'live',
    });
  });

  it('returns the { transactions, nextCursor } envelope', async () => {
    vi.mocked(listTransactionsPage).mockResolvedValueOnce({
      data: [{ id: 'tx-1' }] as never,
      nextCursor: 'next',
    });
    const res = await GET(req());
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.transactions).toHaveLength(1);
    expect(json.data.nextCursor).toBe('next');
  });
});
