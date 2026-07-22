import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { querySTKPushStatus } from '@/lib/daraja';
import { finalizeTransactionAsync } from '@/lib/transaction-finalization';
import { mapResultCodeToStatus } from '@/lib/mpesa-status';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Authorize CRON request
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

      try {
        const result = await querySTKPushStatus(
          tx.checkoutRequestId,
          (tx.merchant.environment as 'sandbox' | 'live') || 'sandbox'
        );

        if (result.ResultCode != null) {
          const numericResultCode = parseInt(result.ResultCode, 10);
          const status = mapResultCodeToStatus(numericResultCode);
          
          if (status === 'completed' || status === 'cancelled' || status === 'failed') {
            const updatedTx = await prisma.transaction.update({
              where: { id: tx.id },
              data: {
                status,
                resultCode: numericResultCode,
                resultDesc: result.ResultDesc,
                // We won't have mpesaReceipt or amount confirmed from querySTKPushStatus reliably without ResultParameters, 
                // but the status change is critical. Usually Daraja query status returns ResultCode and ResultDesc.
              }
            });

            // Trigger finalization (webhooks/shopify) since the transaction concluded
            finalizeTransactionAsync(updatedTx, tx.merchant);
            successCount++;
          }
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        // If query fails, it might mean the transaction expired without completion
        if (errorMessage.includes('The transaction is being processed') || errorMessage.includes('transaction has not been completed') || errorMessage.includes('status: 400') || errorMessage.includes('status: 500')) {
          // still pending, leave it
        } else {
          // mark as failed based on Daraja error
          const updatedTx = await prisma.transaction.update({
            where: { id: tx.id },
            data: {
              status: 'failed',
              resultDesc: errorMessage || 'Daraja query failed'
            }
          });
          finalizeTransactionAsync(updatedTx, tx.merchant);
          failCount++;
        }
        logger.error(`[Reconcile Cron] Failed to process tx ${tx.id}`, err);
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
