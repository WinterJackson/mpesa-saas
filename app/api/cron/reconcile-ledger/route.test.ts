import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from './route';
import { findStalePendingRecords, upsertMismatch } from '@/lib/repositories/reconciliation';

vi.mock('@/lib/repositories/reconciliation', () => ({
  findStalePendingRecords: vi.fn(),
  upsertMismatch: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

function req(token: string) {
  return new Request('http://localhost/api/cron/reconcile-ledger', { headers: { authorization: `Bearer ${token}` } });
}

describe('GET /api/cron/reconcile-ledger', () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: 'test-secret' };
    vi.clearAllMocks();
  });
  afterEach(() => { process.env = originalEnv; });

  it('401s an invalid CRON secret', async () => {
    const res = await GET(req('wrong'));
    expect(res.status).toBe(401);
    expect(findStalePendingRecords).not.toHaveBeenCalled();
  });

  it('surfaces each stale record as a mismatch and never mutates status', async () => {
    vi.mocked(findStalePendingRecords).mockResolvedValueOnce([
      { organizationId: 'org-1', resourceType: 'payout', resourceId: 'p-1', reason: 'stuck' },
      { organizationId: 'org-2', resourceType: 'transaction', resourceId: 't-1', reason: 'stuck' },
    ]);

    const res = await GET(req('test-secret'));
    const data = await res.json();

    expect(upsertMismatch).toHaveBeenCalledTimes(2);
    expect(upsertMismatch).toHaveBeenCalledWith(expect.objectContaining({ resourceType: 'payout', resourceId: 'p-1' }));
    expect(data.surfaced).toBe(2);
  });

  it('reports zero when the ledger is clean', async () => {
    vi.mocked(findStalePendingRecords).mockResolvedValueOnce([]);
    const res = await GET(req('test-secret'));
    const data = await res.json();
    expect(data.surfaced).toBe(0);
    expect(upsertMismatch).not.toHaveBeenCalled();
  });
});
