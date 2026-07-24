import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma, withTenantContext } from '@/lib/db';
import { recordDelivery, listDeliveries, findDelivery } from './webhook-deliveries';

// WebhookDelivery has Row-Level Security enabled — the repository now routes
// every call through withTenantContext instead of the bare prisma client.
// Mocked here as "open a transaction and hand back the same fake client",
// so assertions against prisma.webhookDelivery.* below still see the calls
// (it's the same object reference passed through as `tx`).
vi.mock('@/lib/db', () => {
  const client = {
    webhookDelivery: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  return {
    prisma: client,
    withTenantContext: vi.fn((_organizationId: string, fn: (tx: typeof client) => unknown) => fn(client)),
  };
});

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

  it('every read/write opens its Row-Level Security tenant context for the right organization', async () => {
    await recordDelivery({
      organizationId: 'org-1',
      event: 'payment.completed',
      url: 'https://h',
      payload: {},
      statusCode: 200,
      success: true,
      attempt: 1,
    });
    vi.mocked(prisma.webhookDelivery.findMany).mockResolvedValueOnce([]);
    await listDeliveries('org-2');
    await findDelivery('org-3', 'wd-1');

    expect(withTenantContext).toHaveBeenNthCalledWith(1, 'org-1', expect.any(Function));
    expect(withTenantContext).toHaveBeenNthCalledWith(2, 'org-2', expect.any(Function));
    expect(withTenantContext).toHaveBeenNthCalledWith(3, 'org-3', expect.any(Function));
  });

  it('recordDelivery uses an already-open tenant-scoped client when one is passed, without opening a new one', async () => {
    vi.mocked(withTenantContext).mockClear();
    const suppliedClient = { webhookDelivery: { create: vi.fn().mockResolvedValueOnce({ id: 'wd-3' }) } };
    await recordDelivery(
      {
        organizationId: 'org-1',
        event: 'payment.completed',
        url: 'https://h',
        payload: {},
        statusCode: 200,
        success: true,
        attempt: 1,
      },
      suppliedClient as never
    );
    expect(withTenantContext).not.toHaveBeenCalled();
    expect(suppliedClient.webhookDelivery.create).toHaveBeenCalled();
  });
});
