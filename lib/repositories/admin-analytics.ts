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
