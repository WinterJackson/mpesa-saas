import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Real next/server after() throws outside a request scope; stub it to a
// no-op so fire-and-forget email dispatch doesn't break the route under test.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: () => {},
}));
import { GET } from './route';
import {
  listSubscriptionsDueForBilling,
  recordUsage,
  createInvoice,
  advanceBillingPeriod,
} from '@/lib/repositories/billing';
import { transactionUsageForPeriod } from '@/lib/repositories/transactions';

vi.mock('@/lib/repositories/billing', () => ({
  listSubscriptionsDueForBilling: vi.fn(),
  recordUsage: vi.fn(),
  createInvoice: vi.fn(),
  advanceBillingPeriod: vi.fn(),
}));

vi.mock('@/lib/repositories/transactions', () => ({
  transactionUsageForPeriod: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function makeRequest() {
  return new Request('http://localhost/api/cron/aggregate-usage', {
    headers: { authorization: 'Bearer test-secret' },
  });
}

describe('GET /api/cron/aggregate-usage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: 'test-secret' };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 401 when unauthorized', async () => {
    const response = await GET(new Request('http://localhost', { headers: { authorization: 'Bearer wrong' } }));
    expect(response.status).toBe(401);
  });

  it('aggregates usage, creates an invoice combining monthlyFee and usage fees, and advances the period', async () => {
    const periodEnd = new Date();
    vi.mocked(listSubscriptionsDueForBilling).mockResolvedValueOnce([
      {
        id: 'sub-1',
        organizationId: 'org-1',
        currentPeriodEnd: periodEnd,
        plan: { monthlyFee: 5000, txFeeBps: 100 },
      },
    ] as never);
    vi.mocked(transactionUsageForPeriod).mockResolvedValueOnce({ txCount: 10, txVolume: 100_000 });

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(recordUsage).toHaveBeenCalledWith('sub-1', expect.objectContaining({ txCount: 10, txVolume: 100_000 }));
    // 5000 (monthlyFee) + 100_000 * 100bps/10000 = 5000 + 1000 = 6000
    expect(createInvoice).toHaveBeenCalledWith('sub-1', 6000);
    expect(advanceBillingPeriod).toHaveBeenCalledWith('sub-1');
    expect(data.processed).toBe(1);
  });

  it('processes zero subscriptions cleanly when none are due', async () => {
    vi.mocked(listSubscriptionsDueForBilling).mockResolvedValueOnce([]);
    const response = await GET(makeRequest());
    const data = await response.json();
    expect(data.processed).toBe(0);
    expect(createInvoice).not.toHaveBeenCalled();
  });
});
