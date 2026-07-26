import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSignupFunnel, getMrrAndChurn } from './admin-analytics';
import { prismaReadonly } from '@/lib/db-readonly';
import { getAdminBillingOverview } from '@/lib/repositories/billing';

vi.mock('@/lib/db-readonly', () => ({
  prismaReadonly: {
    organization: { count: vi.fn() },
    subscription: { groupBy: vi.fn(), count: vi.fn() },
    plan: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/repositories/billing', () => ({
  getAdminBillingOverview: vi.fn(),
}));

describe('admin-analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSignupFunnel', () => {
    it('returns counts in sequence', async () => {
      const scope = { since: new Date('2023-01-01'), until: new Date('2023-02-01') };

      // Mock sequence matches the Promise.all array in getSignupFunnel
      vi.mocked(prismaReadonly.organization.count)
        .mockResolvedValueOnce(100 as never) // signedUp
        .mockResolvedValueOnce(80 as never) // sandboxTested
        .mockResolvedValueOnce(50 as never) // kycSubmitted
        .mockResolvedValueOnce(40 as never) // kycApproved
        .mockResolvedValueOnce(30 as never) // firstLiveTransaction
        .mockResolvedValueOnce(20 as never); // becamePaying

      const funnel = await getSignupFunnel(scope);

      expect(funnel).toEqual([
        { label: 'Signed up', value: 100 },
        { label: 'Sandbox tested', value: 80 },
        { label: 'KYC submitted', value: 50 },
        { label: 'KYC approved', value: 40 },
        { label: 'Live transaction', value: 30 },
        { label: 'Became paying', value: 20 },
      ]);
    });
  });

  describe('getMrrAndChurn', () => {
    it('computes churn and mom growth based on transition data', async () => {
      const scope = { since: new Date('2023-01-01'), until: new Date('2023-02-01') };

      vi.mocked(getAdminBillingOverview).mockResolvedValue({
        mrr: 1500,
        byPlan: [],
        atRiskCount: 0,
        atRisk: [],
        activeCount: 1,
        totalSubscriptions: 1,
      } as never);

      // 1 sub active since before window (1000 KES)
      // 1 sub that was active but churned in the window (500 KES)
      vi.mocked(prismaReadonly.subscription.groupBy).mockResolvedValue([
        {
          planId: 'plan_1',
          _count: { _all: 1 },
        },
        {
          planId: 'plan_2',
          _count: { _all: 1 },
        },
      ] as never);

      vi.mocked(prismaReadonly.plan.findMany).mockResolvedValue([
        { id: 'plan_1', monthlyFee: 1000 },
        { id: 'plan_2', monthlyFee: 500 },
      ] as never);

      // Count churned: returns 1
      vi.mocked(prismaReadonly.subscription.count).mockResolvedValue(1 as never);

      const result = await getMrrAndChurn(scope);

      // startActiveCount should be 2. churnedCount should be 1. Churn rate = 50%
      // startMrr = 1500. currentMrr = 1500. momChangePct = 0.
      expect(result.mrr).toBe(1500);
      expect(result.momChangePct).toBe(0);
      expect(result.churnRatePct).toBe(50);
      expect(result.churnMethod).toBe('transition');
    });
  });
});
