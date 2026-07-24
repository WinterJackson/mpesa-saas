import { NextResponse, after } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { notifyInvoiceIssued } from '@/lib/email/notifications';
import {
  listSubscriptionsDueForBilling,
  recordUsage,
  createInvoice,
  advanceBillingPeriod,
  computeInvoiceAmount,
} from '@/lib/repositories/billing';
import { transactionUsageForPeriod } from '@/lib/repositories/transactions';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * GET /api/cron/aggregate-usage
 *
 * Scheduled job (external cron via cron-job.org): for every Subscription whose billing
 * period has elapsed, aggregates the org's completed-transaction volume for
 * that period into a UsageRecord, generates a pending Invoice
 * (monthlyFee + flat overageFeeKes per transaction beyond the plan's included
 * volume — never a % of value), and advances the billing period.
 *
 * This phase ships manual collection only (per the explicit scope decision
 * to defer live Flutterwave/Paystack integration) — an admin marks the
 * resulting Invoice paid from the admin console. The aggregation itself is
 * real and automated; only the money-movement step is manual.
 */
export async function GET(request: Request) {
  try {
    if (!isAuthorizedCronRequest(request)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const dueSubscriptions = await listSubscriptionsDueForBilling();
    let processed = 0;

    for (const subscription of dueSubscriptions) {
      const periodEnd = subscription.currentPeriodEnd;
      const periodStart = new Date(periodEnd.getTime() - PERIOD_MS);

      const usage = await transactionUsageForPeriod(subscription.organizationId, periodStart, periodEnd);
      await recordUsage(subscription.id, { periodStart, periodEnd, ...usage });

      const amount = computeInvoiceAmount(subscription.plan, usage.txCount);
      await createInvoice(subscription.id, amount);
      await advanceBillingPeriod(subscription.id);

      after(() => notifyInvoiceIssued(subscription.organizationId, amount));

      processed++;
    }

    return NextResponse.json({ success: true, processed }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Aggregate Usage Cron Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
