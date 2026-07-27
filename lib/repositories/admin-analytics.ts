import { prismaReadonly } from '@/lib/db-readonly';
import { changePct } from '@/lib/repositories/analytics';
import { getAdminBillingOverview } from '@/lib/repositories/billing';

export interface FunnelStage {
  label: string;
  value: number;
}

export async function getSignupFunnel(scope: { since: Date; until: Date }): Promise<FunnelStage[]> {
  const [
    signedUp,
    sandboxTested,
    kycSubmitted,
    kycApproved,
    firstLiveTransaction,
    becamePaying,
  ] = await Promise.all([
    // signedUp
    prismaReadonly.organization.count({
      where: { createdAt: { gte: scope.since, lt: scope.until } },
    }),
    // sandboxTested
    prismaReadonly.organization.count({
      where: {
        createdAt: { gte: scope.since, lt: scope.until },
        transactions: { some: { environment: 'sandbox' } },
      },
    }),
    // kycSubmitted
    prismaReadonly.organization.count({
      where: {
        createdAt: { gte: scope.since, lt: scope.until },
        kycDocuments: { some: {} },
      },
    }),
    // kycApproved
    prismaReadonly.organization.count({
      where: {
        createdAt: { gte: scope.since, lt: scope.until },
        kycStatus: 'approved',
      },
    }),
    // firstLiveTransaction
    prismaReadonly.organization.count({
      where: {
        createdAt: { gte: scope.since, lt: scope.until },
        transactions: { some: { environment: 'live', status: 'completed' } },
      },
    }),
    // becamePaying
    prismaReadonly.organization.count({
      where: {
        createdAt: { gte: scope.since, lt: scope.until },
        subscription: { plan: { monthlyFee: { gt: 0 } } },
      },
    }),
  ]);

  return [
    { label: 'Signed up', value: signedUp },
    { label: 'Sandbox tested', value: sandboxTested },
    { label: 'KYC submitted', value: kycSubmitted },
    { label: 'KYC approved', value: kycApproved },
    { label: 'Live transaction', value: firstLiveTransaction },
    { label: 'Became paying', value: becamePaying },
  ];
}

export interface MrrAndChurn {
  mrr: number;
  momChangePct: number | null;
  churnRatePct: number;
  churnMethod: 'transition' | 'snapshot_ratio';
}

export async function getMrrAndChurn(scope: { since: Date; until: Date }): Promise<MrrAndChurn> {
  const overview = await getAdminBillingOverview();
  const mrr = overview.mrr;

  const windowStart = scope.since;
  const windowEnd = scope.until;

  const [startActiveSubsGrouped, plans, churnedCount] = await Promise.all([
    prismaReadonly.subscription.groupBy({
      by: ['planId'],
      where: {
        createdAt: { lt: windowStart },
        OR: [
          { status: { in: ['active', 'past_due'] } },
          { status: { in: ['canceled', 'suspended'] }, updatedAt: { gte: windowStart } },
        ],
      },
      _count: { _all: true },
    }),
    prismaReadonly.plan.findMany({ select: { id: true, monthlyFee: true } }),
    prismaReadonly.subscription.count({
      where: {
        status: 'canceled',
        updatedAt: { gte: windowStart, lt: windowEnd },
      },
    }),
  ]);

  const planFeeMap = new Map(plans.map((p) => [p.id, p.monthlyFee]));

  let startMrr = 0;
  let startActiveCount = 0;
  
  for (const group of startActiveSubsGrouped) {
    const count = group._count._all;
    const fee = planFeeMap.get(group.planId) || 0;
    startActiveCount += count;
    startMrr += count * fee;
  }

  const momChangePct = changePct(mrr, startMrr);
  const churnRatePct = startActiveCount > 0 ? (churnedCount / startActiveCount) * 100 : 0;

  return {
    mrr,
    momChangePct,
    churnRatePct,
    churnMethod: 'transition',
  };
}

export interface ArpmResult {
  arpm: number;
  payingCount: number;
}

export async function getArpm(): Promise<ArpmResult> {
  const overview = await getAdminBillingOverview();
  const arpm = overview.payingCount > 0 ? Math.round(overview.mrr / overview.payingCount) : 0;
  return { arpm, payingCount: overview.payingCount };
}

export interface CohortRow {
  cohort: string;
  totalOrganizations: number;
  retained: number;
  retentionPct: number | null;
  cohortAgeMonths: number;
}

export async function getCohortRetention(): Promise<CohortRow[]> {
  const orgs = await prismaReadonly.organization.findMany({
    select: {
      createdAt: true,
      subscription: {
        select: { status: true },
      },
    },
  });

  const cohorts = new Map<string, { total: number; retained: number }>();

  for (const org of orgs) {
    const month = org.createdAt.toISOString().slice(0, 7); // YYYY-MM
    const current = cohorts.get(month) ?? { total: 0, retained: 0 };
    current.total += 1;
    
    if (org.subscription?.status === 'active' || org.subscription?.status === 'past_due') {
      current.retained += 1;
    }
    
    cohorts.set(month, current);
  }

  const now = new Date();
  
  return Array.from(cohorts.entries())
    .map(([cohort, data]) => {
      const [year, month] = cohort.split('-').map(Number);
      const cohortDate = new Date(year, month - 1);
      
      const yearsDiff = now.getFullYear() - cohortDate.getFullYear();
      const monthsDiff = now.getMonth() - cohortDate.getMonth();
      const cohortAgeMonths = yearsDiff * 12 + monthsDiff;

      return {
        cohort,
        totalOrganizations: data.total,
        retained: data.retained,
        retentionPct: data.total > 0 ? (data.retained / data.total) * 100 : null,
        cohortAgeMonths: Math.max(0, cohortAgeMonths), // Avoid negative if same month but slightly older date (handled by purely month-based math though)
      };
    })
    .sort((a, b) => b.cohort.localeCompare(a.cohort)); // Newest first
}

export interface DunningRecovery {
  invoicesWithRetries: number;
  recovered: number;
  recoveryRatePct: number | null;
  method: 'attempt_count_approximation';
}

export async function getDunningRecoveryRate(): Promise<DunningRecovery> {
  const [invoicesWithRetries, recovered] = await Promise.all([
    prismaReadonly.invoice.count({
      where: { attemptCount: { gt: 1 } },
    }),
    prismaReadonly.invoice.count({
      where: { attemptCount: { gt: 1 }, status: 'paid' },
    }),
  ]);

  return {
    invoicesWithRetries,
    recovered,
    recoveryRatePct: invoicesWithRetries > 0 ? (recovered / invoicesWithRetries) * 100 : null,
    method: 'attempt_count_approximation',
  };
}
