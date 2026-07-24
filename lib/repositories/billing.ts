import { prisma } from '@/lib/db';
import { prismaReadonly } from '@/lib/db-readonly';

// ─── Placeholder pricing ──────────────────────────────────────────────────
// NOT a confirmed product/pricing decision — clearly-labeled placeholders per
// the master plan's explicit instruction not to invent real KES figures.
// Flag for a real product decision before onboarding merchants beyond a pilot.
const PLACEHOLDER_PLANS = [
  { name: 'Starter', monthlyFee: 0, txFeeBps: 150, txCapMonthly: 200, apiRateLimitPerMin: 60 },
  { name: 'Growth', monthlyFee: 5000, txFeeBps: 100, txCapMonthly: null, apiRateLimitPerMin: 300 },
] as const;

/** Platform fallback when an org has no subscription/plan or the plan's limit is null. */
export const DEFAULT_API_RATE_LIMIT_PER_MIN = 60;

const TRIAL_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export async function ensurePlansSeeded(): Promise<void> {
  for (const plan of PLACEHOLDER_PLANS) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      // Keep the rate limit in sync on re-seed (the other fields are pricing
      // placeholders left untouched once created).
      update: { apiRateLimitPerMin: plan.apiRateLimitPerMin },
      create: plan,
    });
  }
}

/**
 * The org's per-minute API rate limit from its active plan, or the platform
 * default. Read-only lookup used by lib/plan-rate-limit.ts (which caches it).
 */
export async function getOrgApiRateLimit(organizationId: string): Promise<number> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { plan: { select: { apiRateLimitPerMin: true } } },
  });
  return subscription?.plan?.apiRateLimitPerMin ?? DEFAULT_API_RATE_LIMIT_PER_MIN;
}

export async function getPlanByName(name: string) {
  return prisma.plan.findUnique({ where: { name } });
}

export async function createTrialSubscription(organizationId: string, planId: string) {
  return prisma.subscription.create({
    data: {
      organizationId,
      planId,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + TRIAL_PERIOD_MS),
    },
  });
}

/**
 * Idempotent trial subscription — creates one only if the organization has none.
 * Safe to call on every onboarding attempt (including retries/self-heal).
 */
export async function ensureTrialSubscription(organizationId: string, planId: string) {
  const existing = await prisma.subscription.findUnique({ where: { organizationId }, select: { id: true } });
  if (existing) return existing;
  return createTrialSubscription(organizationId, planId);
}

export async function getSubscriptionForOrganization(organizationId: string) {
  return prisma.subscription.findUnique({
    where: { organizationId },
    include: {
      plan: true,
      invoices: { orderBy: { issuedAt: 'desc' }, take: 12 },
      usageRecords: { orderBy: { periodStart: 'desc' }, take: 12 },
    },
  });
}

export async function listSubscriptionsDueForBilling() {
  return prisma.subscription.findMany({
    where: {
      status: { in: ['active', 'past_due'] },
      currentPeriodEnd: { lte: new Date() },
    },
    include: { organization: true, plan: true },
  });
}

export async function recordUsage(
  subscriptionId: string,
  data: { periodStart: Date; periodEnd: Date; txCount: number; txVolume: number }
) {
  return prisma.usageRecord.create({ data: { subscriptionId, ...data } });
}

export async function createInvoice(subscriptionId: string, amount: number) {
  return prisma.invoice.create({ data: { subscriptionId, amount, status: 'pending' } });
}

export async function advanceBillingPeriod(subscriptionId: string) {
  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: { currentPeriodEnd: new Date(Date.now() + TRIAL_PERIOD_MS) },
  });
}

// ─── Admin-only (manual collection fallback — no live payment provider yet) ──

export async function listAllInvoices(status?: 'pending' | 'paid' | 'failed') {
  // Read-heavy admin billing listing — see lib/db-readonly.ts.
  return prismaReadonly.invoice.findMany({
    where: status ? { status } : undefined,
    orderBy: { issuedAt: 'desc' },
    include: { subscription: { include: { organization: { select: { id: true, businessName: true } } } } },
  });
}

export async function markInvoicePaid(invoiceId: string) {
  // Include the owning organizationId so callers can send the paid-receipt
  // email without a second query.
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'paid' },
    include: { subscription: { select: { organizationId: true } } },
  });
}
