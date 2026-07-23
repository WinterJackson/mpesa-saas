import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { querySTKPushStatus } from '@/lib/daraja';
import { finalizeTransactionAsync } from '@/lib/transaction-finalization';
import { mapResultCodeToStatus } from '@/lib/mpesa-status';
import { logger } from '@/lib/logger';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Authorize the external cron request (cron-job.org) via CRON_SECRET.
    if (!isAuthorizedCronRequest(request)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 2. Fetch pending transactions older than 2 minutes (so we don't interfere with active ones)
    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        status: 'pending',
        createdAt: {
          lt: new Date(Date.now() - 2 * 60 * 1000)
        }
      },
      include: { merchant: true },
      take: 50 // process in batches
    });

    let successCount = 0;
    let failCount = 0;

    // 3. Process each pending transaction
    for (const tx of pendingTransactions) {
      if (!tx.checkoutRequestId) continue;

      const organizationId = tx.organizationId ?? tx.merchant.organizationId;
      if (!organizationId) {
        logger.warn(`[Reconcile Cron] Transaction ${tx.id} has no organizationId — skipping until the Organization backfill runs.`);
        continue;
      }

      const isOlderThan30Mins = (Date.now() - tx.createdAt.getTime()) >= 30 * 60 * 1000;

      try {
        const result = await querySTKPushStatus(
          tx.checkoutRequestId,
          organizationId,
          (tx.merchant.environment as 'sandbox' | 'live') || 'sandbox'
        );

        if (result.ResultCode != null) {
          const numericResultCode = parseInt(result.ResultCode, 10);
          const status = mapResultCodeToStatus(numericResultCode);
          
          if (status === 'completed') {
            // Asymmetric trust: Only a confirmed 'completed' (ResultCode === 0) is trusted
            // from the Query API to self-heal.
            const updatedTx = await prisma.transaction.update({
              where: { id: tx.id },
              data: {
                status: 'completed',
                resultCode: numericResultCode,
                resultDesc: result.ResultDesc,
              }
            });

            // Trigger finalization (webhooks/shopify) since the transaction concluded successfully
            finalizeTransactionAsync(updatedTx, tx.merchant);
            successCount++;
          } else {
            // Non-zero ResultCode.
            // DO NOT trust it to mark the transaction failed/cancelled yet due to documented false negatives.
            // Citing bce05fa: Safaricom's Query endpoint is unreliable and can return false failures.
            // The webhook callback is the only definitive source of failure.
            if (isOlderThan30Mins) {
              await prisma.transaction.update({
                where: { id: tx.id },
                data: {
                  status: 'expired',
                  resultCode: numericResultCode,
                  resultDesc: result.ResultDesc || 'Transaction abandoned/expired without successful confirmation'
                }
              });
              logger.warn(`[Reconcile Cron] Transaction ${tx.id} marked as expired after 30+ minutes of non-zero Query responses. (ResultCode: ${numericResultCode})`);
              failCount++;
            } else {
              // Leave as pending
              logger.debug(`[Reconcile Cron] Transaction ${tx.id} returned non-zero status (${numericResultCode}) but is < 30 mins old. Leaving pending.`);
            }
          }
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        // Citing bce05fa: Safaricom's Query endpoint is unreliable and can return false failures.
        if (isOlderThan30Mins) {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: {
              status: 'expired',
              resultDesc: errorMessage || 'Transaction abandoned/expired with Daraja query failures'
            }
          });
          logger.warn(`[Reconcile Cron] Transaction ${tx.id} marked as expired after 30+ minutes of Query failures. Error: ${errorMessage}`);
          failCount++;
        } else {
          // Leave as pending
          logger.debug(`[Reconcile Cron] Transaction ${tx.id} query failed but is < 30 mins old. Leaving pending. Error: ${errorMessage}`);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: pendingTransactions.length,
      successCount,
      failCount
    });
  } catch (error: unknown) {
    logger.error('[Reconcile Cron Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
