import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSignupFunnel, getMrrAndChurn } from './admin-analytics';
import { prismaReadonly } from '@/lib/db-readonly';
import { getAdminBillingOverview } from '@/lib/repositories/billing';

vi.mock('@/lib/db-readonly', () => ({
  prismaReadonly: {
    organization: { count: vi.fn(), findMany: vi.fn() },
    subscription: { groupBy: vi.fn(), count: vi.fn() },
    plan: { findMany: vi.fn() },
    invoice: { count: vi.fn() },
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

  describe('getArpm', () => {
    it('computes ARPM based on getAdminBillingOverview', async () => {
      vi.mocked(getAdminBillingOverview).mockResolvedValue({
        mrr: 1500,
        payingCount: 3,
      } as never);

      const { getArpm } = await import('./admin-analytics');
      const result = await getArpm();
      expect(result.arpm).toBe(500);
      expect(result.payingCount).toBe(3);
    });

    it('handles zero paying count', async () => {
      vi.mocked(getAdminBillingOverview).mockResolvedValue({
        mrr: 0,
        payingCount: 0,
      } as never);

      const { getArpm } = await import('./admin-analytics');
      const result = await getArpm();
      expect(result.arpm).toBe(0);
      expect(result.payingCount).toBe(0);
    });
  });

  describe('getCohortRetention', () => {
    it('groups by creation month and computes retention', async () => {
      const { getCohortRetention } = await import('./admin-analytics');
      
      vi.mocked(prismaReadonly.organization.findMany).mockResolvedValue([
        // Cohort 2023-01
        {
          createdAt: new Date('2023-01-15T00:00:00Z'),
          subscription: { status: 'active' },
        },
        {
          createdAt: new Date('2023-01-20T00:00:00Z'),
          subscription: { status: 'past_due' },
        },
        {
          createdAt: new Date('2023-01-25T00:00:00Z'),
          subscription: { status: 'canceled' },
        },
        // Cohort 2023-02
        {
          createdAt: new Date('2023-02-10T00:00:00Z'),
          subscription: null, // No subscription at all
        },
      ] as never);

      const result = await getCohortRetention();
      
      expect(result).toHaveLength(2);
      
      // Sorted newest first
      expect(result[0].cohort).toBe('2023-02');
      expect(result[0].totalOrganizations).toBe(1);
      expect(result[0].retained).toBe(0);
      expect(result[0].retentionPct).toBe(0);
      
      expect(result[1].cohort).toBe('2023-01');
      expect(result[1].totalOrganizations).toBe(3);
      expect(result[1].retained).toBe(2);
      expect(result[1].retentionPct).toBeCloseTo(66.67, 1);
    });
  });

  describe('getDunningRecoveryRate', () => {
    it('computes recovery rate from attempt counts', async () => {
      const { getDunningRecoveryRate } = await import('./admin-analytics');
      
      vi.mocked(prismaReadonly.invoice.count)
        .mockResolvedValueOnce(10 as never) // total with retries
        .mockResolvedValueOnce(4 as never); // recovered

      const result = await getDunningRecoveryRate();
      expect(result.invoicesWithRetries).toBe(10);
      expect(result.recovered).toBe(4);
      expect(result.recoveryRatePct).toBe(40);
      expect(result.method).toBe('attempt_count_approximation');
    });

    it('handles zero retries gracefully', async () => {
      const { getDunningRecoveryRate } = await import('./admin-analytics');
      
      vi.mocked(prismaReadonly.invoice.count)
        .mockResolvedValueOnce(0 as never)
        .mockResolvedValueOnce(0 as never);

      const result = await getDunningRecoveryRate();
      expect(result.invoicesWithRetries).toBe(0);
      expect(result.recovered).toBe(0);
      expect(result.recoveryRatePct).toBeNull();
    });
  });
});
