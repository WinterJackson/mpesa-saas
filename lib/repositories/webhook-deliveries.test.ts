import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { recordDelivery, listDeliveries, findDelivery } from './webhook-deliveries';

vi.mock('@/lib/db', () => ({
  prisma: {
    webhookDelivery: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

describe('webhook-deliveries repository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recordDelivery stores status "delivered" on success', async () => {
    vi.mocked(prisma.webhookDelivery.create).mockResolvedValueOnce({ id: 'wd-1' } as never);
    await recordDelivery({
      organizationId: 'org-1',
      event: 'payment.completed',
      transactionId: 'tx-1',
      url: 'https://h',
      payload: { a: 1 },
      statusCode: 200,
      success: true,
      attempt: 1,
    });
    const arg = vi.mocked(prisma.webhookDelivery.create).mock.calls[0][0] as { data: { status: string; organizationId: string } };
    expect(arg.data.status).toBe('delivered');
    expect(arg.data.organizationId).toBe('org-1');
  });

  it('recordDelivery stores status "failed" (dead-letter) when not delivered', async () => {
    vi.mocked(prisma.webhookDelivery.create).mockResolvedValueOnce({ id: 'wd-2' } as never);
    await recordDelivery({
      organizationId: 'org-1',
      event: 'payout.failed',
      payoutId: 'p-1',
      url: 'https://h',
      payload: {},
      statusCode: 500,
      success: false,
      attempt: 3,
    });
    const arg = vi.mocked(prisma.webhookDelivery.create).mock.calls[0][0] as { data: { status: string } };
    expect(arg.data.status).toBe('failed');
  });

  it('listDeliveries is org-scoped, ordered desc, and derives resourceType across all types', async () => {
    vi.mocked(prisma.webhookDelivery.findMany).mockResolvedValueOnce([
      { id: 'a', event: 'payment.completed', url: 'u', statusCode: 200, success: true, status: 'delivered', attempt: 1, createdAt: new Date(), transactionId: 'tx-1', payoutId: null, refundId: null, payload: {} },
      { id: 'b', event: 'payout.completed', url: 'u', statusCode: 200, success: true, status: 'delivered', attempt: 1, createdAt: new Date(), transactionId: null, payoutId: 'p-1', refundId: null, payload: {} },
      { id: 'c', event: 'refund.completed', url: 'u', statusCode: 200, success: true, status: 'delivered', attempt: 1, createdAt: new Date(), transactionId: null, payoutId: null, refundId: 'r-1', payload: {} },
    ] as never);

    const page = await listDeliveries('org-1', { limit: 10 });
    expect(prisma.webhookDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-1' }) })
    );
    expect(page.data.map((d) => d.resourceType)).toEqual(['transaction', 'payout', 'refund']);
    expect(page.data[0].resourceId).toBe('tx-1');
    expect(page.data[1].resourceId).toBe('p-1');
  });

  it('findDelivery is org-scoped', async () => {
    vi.mocked(prisma.webhookDelivery.findFirst).mockResolvedValueOnce(null as never);
    await findDelivery('org-1', 'wd-1');
    expect(prisma.webhookDelivery.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'wd-1', organizationId: 'org-1' } })
    );
  });
});
