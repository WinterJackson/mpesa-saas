import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { findStalePendingRecords, upsertMismatch } from '@/lib/repositories/reconciliation';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Nightly ledger reconciliation. Surfaces records a Daraja callback should have
// resolved but didn't (pending past the window) as ReconciliationMismatch rows
// for admin review. It NEVER mutates a record's status — asymmetric trust
// (guardrail #4) means we surface anomalies for humans, we don't auto-fail.
// Separate from the 2-min STK reconcile-transactions cron, which is unchanged.

const STALE_MS = 60 * 60 * 1000; // 1 hour — well past every callback's window

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

    const stale = await findStalePendingRecords(STALE_MS);
    for (const record of stale) {
      await upsertMismatch(record);
    }

    logger.info(`[Reconcile Ledger] Surfaced ${stale.length} stale record(s) for review.`);
    return NextResponse.json({ success: true, surfaced: stale.length });
  } catch (error: unknown) {
    logger.error('[Reconcile Ledger Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
