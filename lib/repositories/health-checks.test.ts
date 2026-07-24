import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordHealthCheck, latestComponentStatuses, componentHistory } from './health-checks';
import { prisma } from '@/lib/db';
import { prismaReadonly } from '@/lib/db-readonly';

vi.mock('@/lib/db', () => ({
  prisma: { healthCheck: { create: vi.fn() } },
}));
vi.mock('@/lib/db-readonly', () => ({
  prismaReadonly: { healthCheck: { findFirst: vi.fn(), findMany: vi.fn() } },
}));

describe('health-checks repository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recordHealthCheck writes to the primary client', async () => {
    await recordHealthCheck({ component: 'database', status: 'operational', latencyMs: 5 });
    expect(prisma.healthCheck.create).toHaveBeenCalledWith({
      data: { component: 'database', status: 'operational', latencyMs: 5 },
    });
  });

  it('latestComponentStatuses filters out components with no recorded check', async () => {
    vi.mocked(prismaReadonly.healthCheck.findFirst)
      .mockResolvedValueOnce({ component: 'database', status: 'operational', latencyMs: 3, checkedAt: new Date() } as never)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ component: 'daraja_sandbox', status: 'down', latencyMs: null, checkedAt: new Date() } as never);

    const statuses = await latestComponentStatuses();
    expect(statuses.map((s) => s.component)).toEqual(['database', 'daraja_sandbox']);
  });

  it('componentHistory buckets by day and keeps the WORST status per day', async () => {
    vi.mocked(prismaReadonly.healthCheck.findMany).mockResolvedValueOnce([
      { status: 'operational', checkedAt: new Date('2026-07-01T01:00:00Z') },
      { status: 'down', checkedAt: new Date('2026-07-01T02:00:00Z') },
      { status: 'degraded', checkedAt: new Date('2026-07-01T03:00:00Z') },
      { status: 'operational', checkedAt: new Date('2026-07-02T01:00:00Z') },
    ] as never);

    const history = await componentHistory('database', 90);
    expect(history).toEqual([
      { date: '2026-07-01', status: 'down' },
      { date: '2026-07-02', status: 'operational' },
    ]);
  });
});
