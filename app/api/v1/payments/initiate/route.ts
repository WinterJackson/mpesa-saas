import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { createAndInitiatePayment } from '@/lib/payments';
import { logger } from '@/lib/logger';
import { getCachedIdempotentResponse, cacheIdempotentResponse } from '@/lib/idempotency';
import { parseWith, paymentInitiateRequestSchema } from '@/lib/schemas';
import { enforcePlanRateLimit, rateLimitHeaders, retryAfterSeconds } from '@/lib/plan-rate-limit';

/**
 * POST /api/v1/payments/initiate
 *
 * Merchant-facing endpoint that initiates an M-Pesa Express (STK Push) payment.
 *
 * Flow:
 * 1. Authenticate merchant via x-api-key header
 * 2. Validate phone number and amount
 * 3. Create a pending Transaction record in the database
 * 4. Initiate STK Push via Daraja API
 * 5. Update transaction with CheckoutRequestID
 * 6. If Daraja fails, mark transaction as failed
 *
 * Request Body:
 * { phone: string, amount: number, orderReference?: string }
 *
 * Response:
 * { success: true, data: { transactionId, checkoutRequestId, status, merchantRequestID, customerMessage } }
 */
export async function POST(request: Request) {
  try {
    // ── 1. Authenticate Request ───────────────────────────────────────────────
    const authResult = await authenticateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    const { merchant } = authResult;

    if (authResult.apiKey.scope === 'read_only') {
      return NextResponse.json(
        { success: false, error: 'This API key is read-only and cannot initiate payments' },
        { status: 403 }
      );
    }

    // ── 1b. Per-plan rate limit (org known post-auth) ─────────────────────────
    const rl = await enforcePlanRateLimit(authResult.organizationId, 'payments');
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429, headers: { ...rateLimitHeaders(rl), 'Retry-After': String(retryAfterSeconds(rl)) } }
      );
    }

    // ── 2. Idempotency Check ──────────────────────────────────────────────────
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const cached = await getCachedIdempotentResponse(idempotencyKey, authResult.organizationId);
      if (cached) {
        return NextResponse.json(cached.data, { status: cached.status });
      }
    }

    // ── 3. Parse Body ─────────────────────────────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // ── 3. Validate Inputs (single Zod entry point) ──────────────────────────
    const parsed = parseWith(paymentInitiateRequestSchema, body);
    if (!parsed.ok) {
      const resData = { success: false, error: parsed.error };
      if (idempotencyKey) await cacheIdempotentResponse(idempotencyKey, authResult.organizationId, resData, 400);
      return NextResponse.json(resData, { status: 400 });
    }

    // ── 4. Initiate Payment ─────────────────────────────────────────
    const result = await createAndInitiatePayment({
      merchant,
      organizationId: authResult.organizationId,
      phone: parsed.data.phone,
      amount: parsed.data.amount,
      orderReference: parsed.data.orderReference,
      source: 'api',
    });

    if (!result.success) {
      const resData = { success: false, error: result.error };
      if (idempotencyKey) await cacheIdempotentResponse(idempotencyKey, authResult.organizationId, resData, 502);
      return NextResponse.json(resData, { status: 502 });
    }

    const responseData = {
      success: true,
      data: {
        transactionId: result.transaction!.id,
        checkoutRequestId: result.checkoutRequestId,
        status: 'pending',
        merchantRequestID: result.merchantRequestID,
        customerMessage: result.customerMessage,
      },
    };

    if (idempotencyKey) await cacheIdempotentResponse(idempotencyKey, authResult.organizationId, responseData, 201);
    return NextResponse.json(responseData, { status: 201, headers: rateLimitHeaders(rl) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Payment Initiate Error]:', message);
    return NextResponse.json(
      { success: false, error: 'Internal server error while processing payment' },
      { status: 500 }
    );
  }
}
