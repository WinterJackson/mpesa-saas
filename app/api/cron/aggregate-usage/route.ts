import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import {
  listSubscriptionsDueForBilling,
  recordUsage,
  createInvoice,
  advanceBillingPeriod,
} from '@/lib/repositories/billing';
import { transactionUsageForPeriod } from '@/lib/repositories/transactions';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * GET /api/cron/aggregate-usage
 *
 * Scheduled job (see vercel.json): for every Subscription whose billing
 * period has elapsed, aggregates the org's completed-transaction volume for
 * that period into a UsageRecord, generates a pending Invoice
 * (monthlyFee + txVolume * txFeeBps), and advances the billing period.
 *
 * This phase ships manual collection only (per the explicit scope decision
 * to defer live Flutterwave/Paystack integration) — an admin marks the
 * resulting Invoice paid from the admin console. The aggregation itself is
 * real and automated; only the money-movement step is manual.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const providedToken = authHeader?.split(' ')[1] || '';
    const expectedToken = process.env.CRON_SECRET || '';

    if (
      providedToken.length !== expectedToken.length ||
      !timingSafeEqual(Buffer.from(providedToken), Buffer.from(expectedToken))
    ) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const dueSubscriptions = await listSubscriptionsDueForBilling();
    let processed = 0;

    for (const subscription of dueSubscriptions) {
      const periodEnd = subscription.currentPeriodEnd;
      const periodStart = new Date(periodEnd.getTime() - PERIOD_MS);

      const usage = await transactionUsageForPeriod(subscription.organizationId, periodStart, periodEnd);
      await recordUsage(subscription.id, { periodStart, periodEnd, ...usage });

      const amount = subscription.plan.monthlyFee + Math.round((usage.txVolume * subscription.plan.txFeeBps) / 10_000);
      await createInvoice(subscription.id, amount);
      await advanceBillingPeriod(subscription.id);

      processed++;
    }

    return NextResponse.json({ success: true, processed }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Aggregate Usage Cron Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
