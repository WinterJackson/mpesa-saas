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
  computeInvoiceAmount,
  billingPeriodStart,
  getCurrentPeriodProjection,
  BILLING_PERIOD_MS,
} from './billing';

vi.mock('@/lib/db', () => ({
  prisma: {
    plan: { upsert: vi.fn() },
    subscription: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    usageRecord: { create: vi.fn() },
    invoice: { create: vi.fn(), update: vi.fn() },
    transaction: { aggregate: vi.fn() },
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
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'paid' },
      include: { subscription: { select: { organizationId: true } } },
    });
  });

  it('computeInvoiceAmount is flat-fee: monthlyFee + flat overage, never a % of value', () => {
    const plan = { monthlyFee: 2900, includedTransactions: 1000, overageFeeKes: 6 };
    // Under the included volume → just the monthly fee, regardless of txVolume.
    expect(computeInvoiceAmount(plan, 500)).toBe(2900);
    // Over the included volume → monthly fee + flat per-tx overage.
    expect(computeInvoiceAmount(plan, 1500)).toBe(2900 + 500 * 6);
  });

  it('billingPeriodStart is exactly one billing period before the period end', () => {
    const end = new Date('2026-07-24T00:00:00.000Z');
    expect(billingPeriodStart(end).getTime()).toBe(end.getTime() - BILLING_PERIOD_MS);
  });

  it('getCurrentPeriodProjection reflects live usage and matches the eventual invoice', async () => {
    const currentPeriodEnd = new Date('2026-08-01T00:00:00.000Z');
    const plan = { monthlyFee: 2900, includedTransactions: 1000, overageFeeKes: 6 };
    vi.mocked(prisma.transaction.aggregate).mockResolvedValueOnce({
      _count: { id: 1200 },
      _sum: { amount: 5_000_000 },
    } as never);

    const projection = await getCurrentPeriodProjection({ organizationId: 'org-1', currentPeriodEnd, plan });

    // Window is [end - period, end).
    const call = vi.mocked(prisma.transaction.aggregate).mock.calls[0][0];
    expect(call?.where?.organizationId).toBe('org-1');
    expect(call?.where?.status).toBe('completed');
    expect(projection.txCount).toBe(1200);
    expect(projection.overageCount).toBe(200);
    // Projection uses the same flat-fee formula the usage cron will invoice.
    expect(projection.projectedAmount).toBe(computeInvoiceAmount(plan, 1200));
  });
});
