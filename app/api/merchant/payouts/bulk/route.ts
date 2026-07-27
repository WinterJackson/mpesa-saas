import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { requireRole, PAYOUT_ROLES } from '@/lib/rbac';
import { z } from 'zod';
import { payoutCreateRequestSchema } from '@/lib/schemas';
import { resolvePayoutApprovalThreshold, initiateAndPersistPayoutB2C } from '@/lib/payouts';
import { createPayout } from '@/lib/repositories/payouts';
import { inngest, BULK_PAYOUT_PROCESS_EVENT, isInngestConfigured } from '@/lib/inngest';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';
import { getCachedIdempotentResponse, cacheIdempotentResponse } from '@/lib/idempotency';
import type { B2CCommandID } from '@/lib/daraja-b2c';

const bulkPayoutSchema = z.array(payoutCreateRequestSchema);

export async function POST(request: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const context = await getOrganizationContext(userId, orgId);
    if (!context || !context.merchant) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }
    const merchant = context.merchant;

    const rbac = await requireRole(context.organization.id, userId, PAYOUT_ROLES);
    if (!rbac.allowed) {
      return NextResponse.json({ success: false, error: rbac.error }, { status: 403 });
    }

    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (idempotencyKey) {
      const cached = await getCachedIdempotentResponse(idempotencyKey, context.organization.id);
      if (cached) return NextResponse.json(cached.data, { status: cached.status });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = bulkPayoutSchema.safeParse(body);
    if (!parsed.success) {
      const resData = { success: false, error: 'Invalid payload format' };
      if (idempotencyKey) await cacheIdempotentResponse(idempotencyKey, context.organization.id, resData, 400);
      return NextResponse.json(resData, { status: 400 });
    }

    const rows = parsed.data;
    if (rows.length === 0) {
      const resData = { success: false, error: 'No payout rows provided' };
      if (idempotencyKey) await cacheIdempotentResponse(idempotencyKey, context.organization.id, resData, 400);
      return NextResponse.json(resData, { status: 400 });
    }

    const threshold = await resolvePayoutApprovalThreshold(context.organization.id);

    let queuedCount = 0;
    let approvalCount = 0;
    const rowOutcomes: Array<{ index: number; outcome: 'queued' | 'approval_pending' | 'failed' }> = [];

    const settleResults = await Promise.allSettled(rows.map(async (row, i) => {
      const requiresApproval = row.amount >= threshold;
      
      const payout = await createPayout(context.organization.id, {
        merchantId: merchant.id,
        amount: row.amount,
        phone: row.phone,
        commandId: row.commandId as B2CCommandID | undefined,
        remarks: row.remarks,
        occasion: row.occasion,
        environment: merchant.environment,
        initiatedByUserId: userId,
        requiresApproval,
        approvalStatus: requiresApproval ? 'pending' : 'not_required',
      });

      if (requiresApproval) {
        return { index: i, outcome: 'approval_pending' as const };
      } else {
        if (isInngestConfigured()) {
          await inngest.send({
            name: BULK_PAYOUT_PROCESS_EVENT,
            data: {
              organizationId: context.organization.id,
              payoutId: payout.id,
              environment: merchant.environment as 'sandbox' | 'live',
              amount: row.amount,
              phone: row.phone,
              commandId: row.commandId ?? undefined,
              remarks: row.remarks ?? undefined,
              occasion: row.occasion ?? undefined,
            }
          });
        } else {
          await initiateAndPersistPayoutB2C(context.organization.id, payout.id, {
            environment: merchant.environment as 'sandbox' | 'live',
            amount: row.amount,
            phone: row.phone,
            commandId: row.commandId ?? undefined,
            remarks: row.remarks ?? undefined,
            occasion: row.occasion ?? undefined,
          });
        }
        return { index: i, outcome: 'queued' as const };
      }
    }));

    for (let i = 0; i < settleResults.length; i++) {
      const res = settleResults[i];
      if (res.status === 'fulfilled') {
        if (res.value.outcome === 'queued') queuedCount++;
        else if (res.value.outcome === 'approval_pending') approvalCount++;
        rowOutcomes.push(res.value);
      } else {
        logger.error(`[Bulk Payout Error] Row ${i} failed:`, res.reason);
        rowOutcomes.push({ index: i, outcome: 'failed' });
      }
    }

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'payout.bulk_initiated',
      metadata: { totalRows: rows.length, queuedCount, approvalCount },
    });

    const responseData = { success: true as const, data: { queued: queuedCount, requiresApproval: approvalCount, outcomes: rowOutcomes } };
    if (idempotencyKey) await cacheIdempotentResponse(idempotencyKey, context.organization.id, responseData, 200);
    
    return NextResponse.json(responseData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Bulk Payout Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error while processing bulk payouts' }, { status: 500 });
  }
}
