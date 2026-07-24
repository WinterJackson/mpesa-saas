import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { runDunningCycle } from '@/lib/billing/subscription-billing';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/process-billing
 *
 * Scheduled dunning job (external cron via cron-job.org, gated by lib/cron-auth).
 * Runs one dunning pass over every open subscription invoice: (re)sends STK
 * charges that are due, and soft-locks (suspends) subscriptions whose grace
 * window has elapsed with retries exhausted. Terminal payment status is written
 * ONLY by the billing callback — this job never marks an invoice paid/failed
 * itself. Idempotent; safe to run every few hours.
 */
export async function GET(request: Request) {
  try {
    if (!isAuthorizedCronRequest(request)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const summary = await runDunningCycle();
    return NextResponse.json({ success: true, ...summary }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Process Billing Cron Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
