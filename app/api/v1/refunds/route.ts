import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { validateAmount } from '@/lib/validation';
import { findTransactionById } from '@/lib/repositories/transactions';
import { createAndInitiateRefund } from '@/lib/payouts';
import { getCachedIdempotentResponse, cacheIdempotentResponse } from '@/lib/idempotency';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * POST /api/v1/refunds — refund a completed Transaction via B2C. read_write only.
 * Body: { transactionId, amount?, reason? }. amount defaults to the full
 * transaction amount; the customer phone is taken from the original transaction.
 */
export async function POST(request: Request) {
  try {
    const authResult = await authenticateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }

    const { merchant } = authResult;
    if (authResult.apiKey.scope === 'read_only') {
      return NextResponse.json({ success: false, error: 'This API key is read-only and cannot issue refunds' }, { status: 403 });
    }

    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const cached = await getCachedIdempotentResponse(idempotencyKey, authResult.organizationId);
      if (cached) return NextResponse.json(cached.data, { status: cached.status });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { transactionId, amount, reason } = body;
    if (typeof transactionId !== 'string' || !transactionId) {
      return NextResponse.json({ success: false, error: 'transactionId is required' }, { status: 400 });
    }

    // Org-scoped lookup — a merchant can only refund their own transactions.
    const transaction = await findTransactionById(authResult.organizationId, transactionId);
    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }
    if (transaction.status !== 'completed') {
      return NextResponse.json({ success: false, error: 'Only completed transactions can be refunded' }, { status: 400 });
    }

    // Default to a full refund; a partial amount must not exceed the original.
    let refundAmount = transaction.amount;
    if (amount !== undefined) {
      const amountValidation = validateAmount(amount);
      if (!amountValidation.valid) {
        const resData = { success: false, error: amountValidation.error };
        if (idempotencyKey) await cacheIdempotentResponse(idempotencyKey, authResult.organizationId, resData, 400);
        return NextResponse.json(resData, { status: 400 });
      }
      if (amountValidation.sanitized! > transaction.amount) {
        return NextResponse.json({ success: false, error: 'Refund amount cannot exceed the original transaction amount' }, { status: 400 });
      }
      refundAmount = amountValidation.sanitized!;
    }

    const result = await createAndInitiateRefund({
      organizationId: authResult.organizationId,
      merchantId: merchant.id,
      transactionId: transaction.id,
      environment: merchant.environment as 'sandbox' | 'live',
      amount: refundAmount,
      phone: transaction.phone,
      reason: reason ? String(reason).substring(0, 100) : null,
    });

    if (!result.success) {
      const resData = { success: false, error: result.error };
      if (idempotencyKey) await cacheIdempotentResponse(idempotencyKey, authResult.organizationId, resData, 502);
      return NextResponse.json(resData, { status: 502 });
    }

    await writeAuditLog({
      organizationId: authResult.organizationId,
      actorId: `apikey:${authResult.apiKey.id}`,
      action: 'refund.initiated',
      metadata: { refundId: result.refundId, transactionId: transaction.id, amount: refundAmount },
    });

    const responseData = {
      success: true,
      data: {
        refundId: result.refundId,
        status: 'pending',
        conversationId: result.conversationId,
        originatorConversationId: result.originatorConversationId,
      },
    };
    if (idempotencyKey) await cacheIdempotentResponse(idempotencyKey, authResult.organizationId, responseData, 201);
    return NextResponse.json(responseData, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Refund Initiate Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error while processing refund' }, { status: 500 });
  }
}
