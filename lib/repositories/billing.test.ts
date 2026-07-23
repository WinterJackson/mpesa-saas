import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import {
  ensurePlansSeeded,
  createTrialSubscription,
  listSubscriptionsDueForBilling,
  recordUsage,
  createInvoice,
  advanceBillingPeriod,
  markInvoicePaid,
} from './billing';

vi.mock('@/lib/db', () => ({
  prisma: {
    plan: { upsert: vi.fn() },
    subscription: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    usageRecord: { create: vi.fn() },
    invoice: { create: vi.fn(), update: vi.fn() },
  },
}));

describe('billing repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ensurePlansSeeded upserts each placeholder plan by name (idempotent)', async () => {
    vi.mocked(prisma.plan.upsert).mockResolvedValue({} as never);
    await ensurePlansSeeded();
    expect(prisma.plan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: 'Starter' } })
    );
    expect(prisma.plan.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: 'Growth' } })
    );
  });

  it('createTrialSubscription sets an active status and a future currentPeriodEnd', async () => {
    vi.mocked(prisma.subscription.create).mockResolvedValueOnce({} as never);
    await createTrialSubscription('org-1', 'plan-1');
    const call = vi.mocked(prisma.subscription.create).mock.calls[0][0];
    expect(call.data.organizationId).toBe('org-1');
    expect(call.data.status).toBe('active');
    expect((call.data.currentPeriodEnd as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it('listSubscriptionsDueForBilling only returns active/past_due subscriptions past their period end', async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValueOnce([] as never);
    await listSubscriptionsDueForBilling();
    const call = vi.mocked(prisma.subscription.findMany).mock.calls[0][0];
    expect(call?.where?.status).toEqual({ in: ['active', 'past_due'] });
  });

  it('recordUsage writes the given subscription and period data', async () => {
    vi.mocked(prisma.usageRecord.create).mockResolvedValueOnce({} as never);
    const periodStart = new Date();
    const periodEnd = new Date();
    await recordUsage('sub-1', { periodStart, periodEnd, txCount: 5, txVolume: 1000 });
    expect(prisma.usageRecord.create).toHaveBeenCalledWith({
      data: { subscriptionId: 'sub-1', periodStart, periodEnd, txCount: 5, txVolume: 1000 },
    });
  });

  it('createInvoice defaults to pending status', async () => {
    vi.mocked(prisma.invoice.create).mockResolvedValueOnce({} as never);
    await createInvoice('sub-1', 5150);
    expect(prisma.invoice.create).toHaveBeenCalledWith({
      data: { subscriptionId: 'sub-1', amount: 5150, status: 'pending' },
    });
  });

  it('advanceBillingPeriod pushes currentPeriodEnd into the future', async () => {
    vi.mocked(prisma.subscription.update).mockResolvedValueOnce({} as never);
    await advanceBillingPeriod('sub-1');
    const call = vi.mocked(prisma.subscription.update).mock.calls[0][0];
    expect(call.where).toEqual({ id: 'sub-1' });
    expect((call.data.currentPeriodEnd as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it('markInvoicePaid sets status to paid', async () => {
    vi.mocked(prisma.invoice.update).mockResolvedValueOnce({} as never);
    await markInvoicePaid('inv-1');
    expect(prisma.invoice.update).toHaveBeenCalledWith({ where: { id: 'inv-1' }, data: { status: 'paid' } });
  });
});
