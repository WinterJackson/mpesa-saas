import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { findTransactionById, listTransactions, transactionStatusSummary, summarizeStats, seedDemoTransactions } from './transactions';

vi.mock('@/lib/db', () => ({
  prisma: {
    transaction: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

describe('transactions repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findTransactionById always filters by organizationId', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValueOnce(null as never);
    await findTransactionById('org-1', 'tx-1');
    expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tx-1', organizationId: 'org-1' } })
    );
  });

  it('seedDemoTransactions refuses when the merchant already has >=5 transactions', async () => {
    vi.mocked(prisma.transaction.count).mockResolvedValueOnce(5 as never);
    const result = await seedDemoTransactions({ organizationId: 'org-1', merchantId: 'm-1', environment: 'sandbox' });
    expect(result).toEqual({ alreadySeeded: true });
    expect(prisma.transaction.createMany).not.toHaveBeenCalled();
  });

  it('seedDemoTransactions is org-scoped and creates demo rows tagged source=demo', async () => {
    vi.mocked(prisma.transaction.count).mockResolvedValueOnce(0 as never);
    vi.mocked(prisma.transaction.createMany).mockResolvedValueOnce({ count: 5 } as never);

    const result = await seedDemoTransactions({ organizationId: 'org-1', merchantId: 'm-1', environment: 'sandbox' });
    expect(result).toEqual({ seeded: 5 });
    expect(prisma.transaction.count).toHaveBeenCalledWith({ where: { organizationId: 'org-1', merchantId: 'm-1' } });
    const call = vi.mocked(prisma.transaction.createMany).mock.calls[0][0] as { data: Array<Record<string, unknown>> };
    expect(call.data).toHaveLength(5);
    expect(call.data.every((r) => r.organizationId === 'org-1' && r.merchantId === 'm-1' && r.source === 'demo')).toBe(true);
  });

  it('listTransactions always filters by organizationId', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValueOnce([] as never);
    await listTransactions('org-1', { take: 25 });
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' }, take: 25 })
    );
  });

  it('listTransactions defaults to take: 50', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValueOnce([] as never);
    await listTransactions('org-1');
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
  });

  it('transactionStatusSummary always filters by organizationId', async () => {
    vi.mocked(prisma.transaction.groupBy).mockResolvedValueOnce([] as never);
    await transactionStatusSummary('org-1');
    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } })
    );
  });

  it('summarizeStats computes totals, revenue, success rate, and pending count', () => {
    const stats = summarizeStats([
      { status: 'completed', _count: { id: 3 }, _sum: { amount: 900 } },
      { status: 'pending', _count: { id: 2 }, _sum: { amount: null } },
      { status: 'failed', _count: { id: 1 }, _sum: { amount: null } },
    ]);

    expect(stats).toEqual({
      totalTransactions: 6,
      totalRevenue: 900,
      successRate: 50,
      pendingCount: 2,
    });
  });

  it('summarizeStats returns zeroes for no transactions', () => {
    expect(summarizeStats([])).toEqual({
      totalTransactions: 0,
      totalRevenue: 0,
      successRate: 0,
      pendingCount: 0,
    });
  });
});
