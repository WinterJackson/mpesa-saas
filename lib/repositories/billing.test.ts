import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import {
  ensurePlansSeeded,
  createTrialSubscription,
  ensureSubscriptionForPlan,
  isSelfServePlanName,
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
    subscription: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    usageRecord: { create: vi.fn() },
    invoice: { create: vi.fn(), update: vi.fn() },
    transaction: { aggregate: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/db-readonly', () => ({
  prismaReadonly: { subscription: { findMany: vi.fn() }, invoice: { findMany: vi.fn() } },
}));

import { prismaReadonly } from '@/lib/db-readonly';
import { getAdminBillingOverview } from './billing';

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

  it('isSelfServePlanName accepts Starter/Growth/Scale and rejects Enterprise/Sandbox', () => {
    expect(isSelfServePlanName('Growth')).toBe(true);
    expect(isSelfServePlanName('Starter')).toBe(true);
    expect(isSelfServePlanName('Enterprise')).toBe(false);
    expect(isSelfServePlanName('Sandbox')).toBe(false);
  });

  it('ensureSubscriptionForPlan is a no-op when the org already has a subscription', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValueOnce({ id: 'sub-1', status: 'active' } as never);
    const res = await ensureSubscriptionForPlan('org-1', { id: 'plan-growth', monthlyFee: 2900 });
    expect(res).toEqual({ id: 'sub-1', status: 'active' });
    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ensureSubscriptionForPlan activates a FREE plan immediately (no invoice)', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.subscription.create).mockResolvedValueOnce({ id: 'sub-free', status: 'active' } as never);
    const res = await ensureSubscriptionForPlan('org-1', { id: 'plan-starter', monthlyFee: 0 });
    expect(res.status).toBe('active');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('ensureSubscriptionForPlan creates a PAID plan as incomplete with a first-period invoice', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValueOnce(null);
    const tx = {
      subscription: { create: vi.fn().mockResolvedValue({ id: 'sub-paid', status: 'incomplete' }) },
      invoice: { create: vi.fn().mockResolvedValue({ id: 'inv-1' }) },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.$transaction).mockImplementationOnce(((cb: (t: unknown) => unknown) => cb(tx)) as any);

    const res = await ensureSubscriptionForPlan('org-1', { id: 'plan-growth', monthlyFee: 2900 });
    expect(res).toEqual({ id: 'sub-paid', status: 'incomplete' });
    expect(tx.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ planId: 'plan-growth', status: 'incomplete' }) })
    );
    expect(tx.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subscriptionId: 'sub-paid', amount: 2900, status: 'pending' }) })
    );
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
      data: { status: 'paid', paidAt: expect.any(Date) },
      include: { subscription: { select: { id: true, organizationId: true } } },
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

  it('getAdminBillingOverview computes MRR (active+past_due), segments, and at-risk list', async () => {
    vi.mocked(prismaReadonly.subscription.findMany).mockResolvedValueOnce([
      { id: 's1', status: 'active', gracePeriodEnd: null, plan: { name: 'Growth', monthlyFee: 2900 }, organization: { id: 'o1', businessName: 'A' }, invoices: [] },
      { id: 's2', status: 'active', gracePeriodEnd: null, plan: { name: 'Growth', monthlyFee: 2900 }, organization: { id: 'o2', businessName: 'B' }, invoices: [] },
      { id: 's3', status: 'past_due', gracePeriodEnd: new Date('2026-08-01'), plan: { name: 'Scale', monthlyFee: 9900 }, organization: { id: 'o3', businessName: 'C' }, invoices: [{ id: 'inv-9', amount: 9900, status: 'failed' }] },
      { id: 's4', status: 'suspended', gracePeriodEnd: new Date('2026-07-01'), plan: { name: 'Starter', monthlyFee: 0 }, organization: { id: 'o4', businessName: 'D' }, invoices: [{ id: 'inv-10', amount: 0, status: 'failed' }] },
    ] as never);

    const overview = await getAdminBillingOverview();

    // MRR = active + past_due plan fees: 2900 + 2900 + 9900 (suspended excluded).
    expect(overview.mrr).toBe(15_700);
    expect(overview.activeCount).toBe(2);
    expect(overview.atRiskCount).toBe(2); // past_due + suspended
    // Segments sorted by MRR desc: Growth (5800) before Scale (9900)? Scale=9900 > Growth=5800.
    expect(overview.byPlan[0].name).toBe('Scale');
    expect(overview.atRisk.find((a) => a.subscriptionId === 's3')?.outstandingAmount).toBe(9900);
  });
});
