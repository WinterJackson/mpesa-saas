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
  // Include the owning organizationId so callers can send the paid-receipt
  // email without a second query.
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: 'paid' },
    include: { subscription: { select: { organizationId: true } } },
  });
}
