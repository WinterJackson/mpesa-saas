import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { findTransactionById } from '@/lib/repositories/transactions';
import { queryTransactionStatus } from '@/lib/daraja-transaction-status';
import { createDarajaCommand } from '@/lib/repositories/daraja-commands';
import { logger } from '@/lib/logger';

/**
 * POST /api/v1/transactions/[id]/status-query — asks Safaricom for the
 * authoritative status of a transaction (by its M-Pesa receipt). Result arrives
 * asynchronously; this returns the queued DarajaCommand id. For reconciliation
 * only — never auto-heals status (guardrail #4). read_write scope.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await authenticateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }
    if (authResult.apiKey.scope === 'read_only') {
      return NextResponse.json({ success: false, error: 'This API key is read-only and cannot run a status query' }, { status: 403 });
    }

    const { id } = await params;
    const transaction = await findTransactionById(authResult.organizationId, id);
    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }
    if (!transaction.mpesaReceipt) {
      return NextResponse.json({ success: false, error: 'Transaction has no M-Pesa receipt to query yet' }, { status: 400 });
    }

    try {
      const res = await queryTransactionStatus({
        organizationId: authResult.organizationId,
        environment: authResult.merchant.environment as 'sandbox' | 'live',
        transactionReceipt: transaction.mpesaReceipt,
      });
      await createDarajaCommand(authResult.organizationId, {
        type: 'transaction_status',
        environment: authResult.merchant.environment,
        originatorConversationId: res.OriginatorConversationID,
        conversationId: res.ConversationID,
        targetReceipt: transaction.mpesaReceipt,
      });
      return NextResponse.json({ success: true, data: { status: 'queued', originatorConversationId: res.OriginatorConversationID } }, { status: 202 });
    } catch (err: unknown) {
      return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Query failed' }, { status: 502 });
    }
  } catch (error: unknown) {
    logger.error('[Transaction Status Query Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
