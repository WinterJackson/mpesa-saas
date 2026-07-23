import { NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/auth';
import { validatePhone, validateAmount } from '@/lib/validation';
import { createAndInitiatePayout } from '@/lib/payouts';
import type { B2CCommandID } from '@/lib/daraja-b2c';
import { getCachedIdempotentResponse, cacheIdempotentResponse } from '@/lib/idempotency';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

const VALID_COMMANDS: B2CCommandID[] = ['BusinessPayment', 'SalaryPayment', 'PromotionPayment'];

/**
 * POST /api/v1/payouts — send money to a customer (B2C). read_write scope only.
 * Body: { phone, amount, commandId?, remarks?, occasion? }
 * Idempotency-Key header strongly recommended (payouts are the highest-cost
 * double-execution failure mode).
 */
export async function POST(request: Request) {
  try {
    const authResult = await authenticateApiKey(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: authResult.status });
    }

    const { merchant } = authResult;
    if (authResult.apiKey.scope === 'read_only') {
      return NextResponse.json({ success: false, error: 'This API key is read-only and cannot send payouts' }, { status: 403 });
    }

    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const cached = await getCachedIdempotentResponse(idempotencyKey, merchant.id);
      if (cached) return NextResponse.json(cached.data, { status: cached.status });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { phone, amount, commandId, remarks, occasion } = body;

    const phoneValidation = validatePhone(phone as string);
    if (!phoneValidation.valid) {
      const resData = { success: false, error: phoneValidation.error };
      if (idempotencyKey) await cacheIdempotentResponse(idempotencyKey, merchant.id, resData, 400);
      return NextResponse.json(resData, { status: 400 });
    }

    const amountValidation = validateAmount(amount);
    if (!amountValidation.valid) {
      const resData = { success: false, error: amountValidation.error };
      if (idempotencyKey) await cacheIdempotentResponse(idempotencyKey, merchant.id, resData, 400);
      return NextResponse.json(resData, { status: 400 });
    }

    const resolvedCommand: B2CCommandID | undefined =
      commandId === undefined ? undefined : VALID_COMMANDS.includes(commandId as B2CCommandID) ? (commandId as B2CCommandID) : undefined;
    if (commandId !== undefined && resolvedCommand === undefined) {
      return NextResponse.json({ success: false, error: `commandId must be one of: ${VALID_COMMANDS.join(', ')}` }, { status: 400 });
    }

    const result = await createAndInitiatePayout({
      organizationId: authResult.organizationId,
      merchantId: merchant.id,
      environment: merchant.environment as 'sandbox' | 'live',
      amount: amountValidation.sanitized!,
      phone: phoneValidation.sanitized!,
      commandId: resolvedCommand,
      remarks: remarks ? String(remarks).substring(0, 100) : null,
      occasion: occasion ? String(occasion).substring(0, 100) : null,
    });

    if (!result.success) {
      const resData = { success: false, error: result.error };
      if (idempotencyKey) await cacheIdempotentResponse(idempotencyKey, merchant.id, resData, 502);
      return NextResponse.json(resData, { status: 502 });
    }

    await writeAuditLog({
      organizationId: authResult.organizationId,
      actorId: `apikey:${authResult.apiKey.id}`,
      action: 'payout.initiated',
      metadata: { payoutId: result.payoutId, amount: amountValidation.sanitized },
    });

    const responseData = {
      success: true,
      data: {
        payoutId: result.payoutId,
        status: 'pending',
        conversationId: result.conversationId,
        originatorConversationId: result.originatorConversationId,
      },
    };
    if (idempotencyKey) await cacheIdempotentResponse(idempotencyKey, merchant.id, responseData, 201);
    return NextResponse.json(responseData, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Payout Initiate Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error while processing payout' }, { status: 500 });
  }
}
