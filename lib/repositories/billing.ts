import { prisma } from '@/lib/db';
import { prismaReadonly } from '@/lib/db-readonly';
import { SEEDABLE_TIERS } from '@/lib/pricing';
import { transactionUsageForPeriod } from '@/lib/repositories/transactions';

/** Fixed billing-cycle length (30 days). The single source for the period window. */
export const BILLING_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Start of the billing period that ends at `currentPeriodEnd`. */
export function billingPeriodStart(currentPeriodEnd: Date): Date {
  return new Date(currentPeriodEnd.getTime() - BILLING_PERIOD_MS);
}

// Real plan tiers (billing/pricing strategy doc §3). FLAT overage fee per
// transaction beyond the included volume — PaySwift never takes a % of a sale.
// Derived from the single pricing catalog in lib/pricing.ts (which the public
// /pricing page and its estimator also read) so display and DB billing can
// never drift. Enterprise is "talk to sales" (custom) and is not seeded.
const SEED_PLANS = SEEDABLE_TIERS.map((t) => ({
  name: t.name,
  monthlyFee: t.monthlyFee,
  includedTransactions: t.includedTransactions,
  overageFeeKes: t.overageFeeKes,
  apiRateLimitPerMin: t.apiRateLimitPerMin,
}));

/** Platform fallback when an org has no subscription/plan or the plan's limit is null. */
export const DEFAULT_API_RATE_LIMIT_PER_MIN = 60;

/**
 * Plans a merchant can pick / switch to without talking to sales. Enterprise is
 * custom ("contact sales") and Sandbox is a free test tier that is NOT a Plan
 * row — both are deliberately excluded here.
 */
export const SELF_SERVE_PLAN_NAMES = ['Starter', 'Growth', 'Scale'] as const;
export type SelfServePlanName = (typeof SELF_SERVE_PLAN_NAMES)[number];

export function isSelfServePlanName(name: string): name is SelfServePlanName {
  return (SELF_SERVE_PLAN_NAMES as readonly string[]).includes(name);
}

const TRIAL_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export async function ensurePlansSeeded(): Promise<void> {
  for (const plan of SEED_PLANS) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      // Pricing is now real (not placeholder): keep every priced field in sync on
      // re-seed so a tier change here propagates. Admin plan-management edits
      // (Stage G) that diverge from these seeds are re-applied on the next seed —
      // treat SEED_PLANS as the source of truth for the standard tiers.
      update: {
        monthlyFee: plan.monthlyFee,
        includedTransactions: plan.includedTransactions,
        overageFeeKes: plan.overageFeeKes,
        apiRateLimitPerMin: plan.apiRateLimitPerMin,
      },
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

/**
 * Idempotent subscription bootstrap keyed on the CHOSEN plan (onboarding).
 * Creates a subscription only if the org has none:
 *  - FREE plan (monthlyFee 0, e.g. Starter): an immediately-`active` subscription
 *    — the free tier needs no payment.
 *  - PAID plan (Growth/Scale): a subscription in `incomplete` status PLUS a
 *    first-period invoice, so the merchant is directed to pay before the plan
 *    activates (pay-first). The billing STK callback flips it to `active` on the
 *    first successful payment.
 * Returns `{ id, status }` for both the created and pre-existing case, so the
 * caller can tell whether payment is still required. Safe on retries/self-heal.
 */
export async function ensureSubscriptionForPlan(
  organizationId: string,
  plan: { id: string; monthlyFee: number }
): Promise<{ id: string; status: string }> {
  const existing = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { id: true, status: true },
  });
  if (existing) return existing;

  if (plan.monthlyFee === 0) {
    const sub = await createTrialSubscription(organizationId, plan.id);
    return { id: sub.id, status: sub.status };
  }

  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        organizationId,
        planId: plan.id,
        status: 'incomplete',
        currentPeriodEnd: new Date(Date.now() + TRIAL_PERIOD_MS),
      },
    });
    await tx.invoice.create({
      data: { subscriptionId: sub.id, amount: plan.monthlyFee, status: 'pending' },
    });
    return { id: sub.id, status: sub.status };
  });
}

/**
 * Switches a subscription onto a different plan (self-service plan change).
 * The caller decides the resulting status (`active` when access continues,
 * `incomplete` when a paid plan must be paid before it unlocks) and issues any
 * fresh invoice separately.
 */
export async function updateSubscriptionPlan(
  subscriptionId: string,
  planId: string,
  status: 'active' | 'incomplete',
  gracePeriodEnd: Date | null = null
) {
  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: { planId, status, gracePeriodEnd },
  });
}

/** Lean subscription status + plan name for the dashboard-wide activation banner. */
export async function getSubscriptionStatus(organizationId: string) {
  return prisma.subscription.findUnique({
    where: { organizationId },
    select: { status: true, plan: { select: { name: true } } },
  });
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

export interface PlanUsageSummary {
  planName: string;
  used: number;
  included: number | null; // null = unlimited (Enterprise)
  projectedOverageKes: number;
}

/**
 * Current-cycle plan usage for the dashboard: transactions used vs the plan's
 * included allowance, and the projected end-of-cycle overage cost (extrapolated
 * from the pace so far). Overage is FLAT-FEE per transaction — never a % of GMV
 * (guardrail #24). Returns null when the org has no subscription yet.
 */
export async function getPlanUsage(organizationId: string): Promise<PlanUsageSummary | null> {
  const sub = await prisma.subscription.findUnique({
    where: { organizationId },
    include: { plan: true },
  });
  if (!sub) return null;

  const periodEnd = sub.currentPeriodEnd;
  const periodStart = billingPeriodStart(periodEnd);
  const { txCount } = await transactionUsageForPeriod(organizationId, periodStart, periodEnd);

  const included = sub.plan.includedTransactions;
  const overageFeeKes = sub.plan.overageFeeKes;

  let projectedOverageKes = 0;
  if (included != null && overageFeeKes != null) {
    const now = Date.now();
    const total = periodEnd.getTime() - periodStart.getTime();
    const elapsed = Math.min(total, Math.max(1, now - periodStart.getTime()));
    const fraction = elapsed / total;
    const projectedCount = fraction > 0 ? Math.round(txCount / fraction) : txCount;
    projectedOverageKes = Math.max(0, projectedCount - included) * overageFeeKes;
  }

  return { planName: sub.plan.name, used: txCount, included, projectedOverageKes };
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

/**
 * Flat-fee invoice amount for a period: the plan's monthly fee plus a flat
 * `overageFeeKes` for every transaction beyond `includedTransactions`. NEVER a
 * percentage of transaction value. The single source of truth for "what does
 * this period cost" — reused by the usage cron, the merchant projected-overage
 * estimate, and the public pricing estimator.
 */
export function computeInvoiceAmount(
  plan: { monthlyFee: number; includedTransactions: number; overageFeeKes: number },
  txCount: number
): number {
  const overageCount = Math.max(0, txCount - plan.includedTransactions);
  return plan.monthlyFee + overageCount * plan.overageFeeKes;
}

/**
 * Live usage + projected charge for a subscription's IN-PROGRESS billing period
 * (read-only — the definitive UsageRecord/Invoice are written by the usage cron
 * at period end). Reuses the flat-fee `computeInvoiceAmount` so the projection
 * shown to the merchant matches the eventual invoice exactly.
 */
export async function getCurrentPeriodProjection(subscription: {
  organizationId: string;
  currentPeriodEnd: Date;
  plan: { monthlyFee: number; includedTransactions: number; overageFeeKes: number };
}) {
  const periodEnd = subscription.currentPeriodEnd;
  const periodStart = billingPeriodStart(periodEnd);
  const usage = await transactionUsageForPeriod(subscription.organizationId, periodStart, periodEnd);
  const overageCount = Math.max(0, usage.txCount - subscription.plan.includedTransactions);
  const projectedAmount = computeInvoiceAmount(subscription.plan, usage.txCount);
  return { periodStart, periodEnd, ...usage, overageCount, projectedAmount };
}

export async function createInvoice(subscriptionId: string, amount: number) {
  return prisma.invoice.create({ data: { subscriptionId, amount, status: 'pending' } });
}

// ─── Billing details + manual pay-now (Stage E) ──────────────────────────────

/** A single invoice, ownership-scoped to the org, for the download/PDF route. */
export async function getInvoiceForOrg(invoiceId: string, organizationId: string) {
  return prisma.invoice.findFirst({
    where: { id: invoiceId, subscription: { organizationId } },
    include: { subscription: { include: { plan: true, organization: true } } },
  });
}

/** The org's billing/tax details for the billing page (no secrets). */
export async function getBillingDetails(organizationId: string) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    select: { billingMpesaPhone: true, billingContactEmail: true, kraPin: true },
  });
}

/** Updates the org's billing payment method / contact (never touches secrets). */
export async function updateBillingDetails(
  organizationId: string,
  data: { billingMpesaPhone?: string | null; billingContactEmail?: string | null }
) {
  return prisma.organization.update({ where: { id: organizationId }, data });
}

/**
 * The org's most recent still-owing invoice (pending or failed), in the shape
 * chargeInvoice needs. Used by the manual "Pay now" action. Returns null when
 * nothing is outstanding or the invoice is already processing/paid.
 */
export async function getLatestUnpaidInvoiceForOrg(organizationId: string) {
  return prisma.invoice.findFirst({
    where: { status: { in: ['pending', 'failed'] }, subscription: { organizationId } },
    orderBy: { issuedAt: 'desc' },
    include: { subscription: { include: { organization: true } } },
  });
}

// ─── Subscription STK collection + dunning (Stage D) ─────────────────────────

/**
 * Marks an invoice as an in-flight STK charge: records the CheckoutRequestID to
 * correlate the billing callback, flips status to `processing`, and increments
 * the dunning attempt counter. A conditional update (only from pending/failed)
 * guards against double-charging an invoice already awaiting a callback.
 */
export async function attachInvoiceCharge(invoiceId: string, checkoutRequestId: string) {
  const result = await prisma.invoice.updateMany({
    where: { id: invoiceId, status: { in: ['pending', 'failed'] } },
    data: {
      status: 'processing',
      mpesaCheckoutRequestId: checkoutRequestId,
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });
  return result.count; // 0 = someone else already advanced it (idempotent no-op)
}

export async function findInvoiceByCheckoutRequestId(checkoutRequestId: string) {
  return prisma.invoice.findUnique({
    where: { mpesaCheckoutRequestId: checkoutRequestId },
    include: { subscription: { include: { organization: true, plan: true } } },
  });
}

/** Terminal success for a subscription charge — written ONLY by the billing callback. */
export async function markInvoicePaidViaMpesa(invoiceId: string, mpesaReceipt: string | null) {
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'paid', paidAt: new Date(), ...(mpesaReceipt ? { mpesaReceipt } : {}) },
    include: { subscription: { select: { id: true, organizationId: true } } },
  });
}

/** A charge attempt failed (callback non-zero, or the STK call itself threw). */
export async function markInvoiceChargeFailed(invoiceId: string, failureReason: string) {
  return prisma.invoice.updateMany({
    where: { id: invoiceId, status: { in: ['processing', 'pending'] } },
    data: { status: 'failed', failureReason: failureReason.slice(0, 200), lastAttemptAt: new Date() },
  });
}

/**
 * Open invoices needing dunning attention: not paid, not currently awaiting a
 * callback. Oldest first. Includes the org (for the billing phone/email) + plan.
 */
export async function listInvoicesForDunning() {
  return prisma.invoice.findMany({
    where: { status: { in: ['pending', 'failed'] } },
    orderBy: { issuedAt: 'asc' },
    include: { subscription: { include: { organization: true, plan: true } } },
  });
}

export async function setSubscriptionStatus(
  subscriptionId: string,
  status: 'active' | 'past_due' | 'suspended' | 'canceled',
  gracePeriodEnd?: Date | null
) {
  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status, ...(gracePeriodEnd !== undefined ? { gracePeriodEnd } : {}) },
  });
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
  // Include the owning subscription id + organizationId so the admin route can
  // reactivate the subscription and send the paid-receipt email without a
  // second query.
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'paid', paidAt: new Date() },
    include: { subscription: { select: { id: true, organizationId: true } } },
  });
}

/**
 * Admin billing overview (read-heavy → replica-friendly client): MRR, active +
 * at-risk counts, per-plan segment revenue, and the at-risk subscription list.
 * MRR counts active + past_due subscriptions (still subscribed) at their plan's
 * monthly fee; at-risk = past_due + suspended, with their latest owing invoice.
 */
export async function getAdminBillingOverview() {
  const subs = await prismaReadonly.subscription.findMany({
    include: {
      plan: { select: { name: true, monthlyFee: true } },
      organization: { select: { id: true, businessName: true } },
      invoices: {
        where: { status: { in: ['pending', 'failed'] } },
        orderBy: { issuedAt: 'desc' },
        take: 1,
        select: { id: true, amount: true, status: true },
      },
    },
  });

  const paying = subs.filter((s) => s.status === 'active' || s.status === 'past_due');
  const mrr = paying.reduce((sum, s) => sum + s.plan.monthlyFee, 0);
  const activeCount = subs.filter((s) => s.status === 'active').length;

  const byPlanMap = new Map<string, { name: string; monthlyFee: number; count: number; mrr: number }>();
  for (const s of paying) {
    const existing = byPlanMap.get(s.plan.name) ?? { name: s.plan.name, monthlyFee: s.plan.monthlyFee, count: 0, mrr: 0 };
    existing.count += 1;
    existing.mrr += s.plan.monthlyFee;
    byPlanMap.set(s.plan.name, existing);
  }

  const atRisk = subs
    .filter((s) => s.status === 'past_due' || s.status === 'suspended')
    .map((s) => ({
      subscriptionId: s.id,
      organizationId: s.organization.id,
      businessName: s.organization.businessName,
      planName: s.plan.name,
      status: s.status,
      gracePeriodEnd: s.gracePeriodEnd,
      outstandingInvoiceId: s.invoices[0]?.id ?? null,
      outstandingAmount: s.invoices[0]?.amount ?? null,
    }));

  return {
    mrr,
    activeCount,
    atRiskCount: atRisk.length,
    totalSubscriptions: subs.length,
    byPlan: [...byPlanMap.values()].sort((a, b) => b.mrr - a.mrr),
    atRisk,
  };
}
