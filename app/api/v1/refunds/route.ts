import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { findTransactionById } from '@/lib/repositories/transactions';
import { createAndInitiateRefund } from '@/lib/payouts';
import { getCachedIdempotentResponse, cacheIdempotentResponse } from '@/lib/idempotency';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';
import { parseWith, refundCreateRequestSchema } from '@/lib/schemas';
import { enforcePlanRateLimit, rateLimitHeaders, retryAfterSeconds } from '@/lib/plan-rate-limit';

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

    const rl = await enforcePlanRateLimit(authResult.organizationId, 'refunds');
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429, headers: { ...rateLimitHeaders(rl), 'Retry-After': String(retryAfterSeconds(rl)) } }
      );
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

    const parsed = parseWith(refundCreateRequestSchema, body);
    if (!parsed.ok) {
      const resData = { success: false, error: parsed.error };
      if (idempotencyKey) await cacheIdempotentResponse(idempotencyKey, authResult.organizationId, resData, 400);
      return NextResponse.json(resData, { status: 400 });
    }

    // Org-scoped lookup — a merchant can only refund their own transactions.
    const transaction = await findTransactionById(authResult.organizationId, parsed.data.transactionId);
    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }
    if (transaction.status !== 'completed') {
      return NextResponse.json({ success: false, error: 'Only completed transactions can be refunded' }, { status: 400 });
    }

    // Default to a full refund; a partial amount must not exceed the original.
    let refundAmount = transaction.amount;
    if (parsed.data.amount !== undefined) {
      if (parsed.data.amount > transaction.amount) {
        return NextResponse.json({ success: false, error: 'Refund amount cannot exceed the original transaction amount' }, { status: 400 });
      }
      refundAmount = parsed.data.amount;
    }

    const result = await createAndInitiateRefund({
      organizationId: authResult.organizationId,
      merchantId: merchant.id,
      transactionId: transaction.id,
      environment: merchant.environment as 'sandbox' | 'live',
      amount: refundAmount,
      phone: transaction.phone,
      reason: parsed.data.reason,
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
    return NextResponse.json(responseData, { status: 201, headers: rateLimitHeaders(rl) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Refund Initiate Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error while processing refund' }, { status: 500 });
  }
}
