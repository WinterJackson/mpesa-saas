import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { validatePhone, validateAmount } from '@/lib/validation';
import { createAndInitiatePayment } from '@/lib/payments';
import { logger } from '@/lib/logger';

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

    // ── 2. Idempotency Check ──────────────────────────────────────────────────
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const { checkIdempotency } = await import('@/lib/rate-limit');
      const isNewRequest = await checkIdempotency(idempotencyKey);
      if (!isNewRequest) {
        return NextResponse.json(
          { success: false, error: 'Duplicate request. A request with this Idempotency-Key is already being processed.' },
          { status: 409 }
        );
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

    const { phone, amount, orderReference } = body;

    // ── 3. Validate Inputs ────────────────────────────────────────────────────
    const phoneValidation = validatePhone(phone as string);
    if (!phoneValidation.valid) {
      return NextResponse.json(
        { success: false, error: phoneValidation.error },
        { status: 400 }
      );
    }

    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      return NextResponse.json(
        { success: false, error: amountValidation.error },
        { status: 400 }
      );
    }

    const sanitizedPhone = phoneValidation.sanitized!;
    const sanitizedAmount = amountValidation.sanitized!;

    // ── 4. Initiate Payment ─────────────────────────────────────────
    const result = await createAndInitiatePayment({
      merchant,
      phone: sanitizedPhone,
      amount: sanitizedAmount,
      orderReference: orderReference ? String(orderReference).substring(0, 50) : null,
      source: 'api',
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          transactionId: result.transaction!.id,
          checkoutRequestId: result.checkoutRequestId,
          status: 'pending',
          merchantRequestID: result.merchantRequestID,
          customerMessage: result.customerMessage,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Payment Initiate Error]:', message);
    return NextResponse.json(
      { success: false, error: 'Internal server error while processing payment' },
      { status: 500 }
    );
  }
}
