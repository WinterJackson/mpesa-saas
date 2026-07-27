import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { requireRole, PAYOUT_ROLES } from '@/lib/rbac';
import { z } from 'zod';
import { payoutCreateRequestSchema } from '@/lib/schemas';
import { getPayoutApprovalRequirement } from '@/lib/payouts';
import { createPayout } from '@/lib/repositories/payouts';
import { inngest, BULK_PAYOUT_PROCESS_EVENT } from '@/lib/inngest';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';
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

    const rbac = await requireRole(context.organization.id, userId, PAYOUT_ROLES);
    if (!rbac.allowed) {
      return NextResponse.json({ success: false, error: rbac.error }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = bulkPayoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid payload format' }, { status: 400 });
    }

    const rows = parsed.data;
    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No payout rows provided' }, { status: 400 });
    }

    let queuedCount = 0;
    let approvalCount = 0;
    const rowOutcomes: Array<{ index: number; outcome: 'queued' | 'approval_pending' }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const { requiresApproval } = await getPayoutApprovalRequirement(context.organization.id, row.amount);
      
      const payout = await createPayout(context.organization.id, {
        merchantId: context.merchant.id,
        amount: row.amount,
        phone: row.phone,
        commandId: row.commandId as B2CCommandID | undefined,
        remarks: row.remarks,
        occasion: row.occasion,
        environment: context.merchant.environment,
        initiatedByUserId: userId,
        requiresApproval,
        approvalStatus: requiresApproval ? 'pending' : 'not_required',
      });

      if (requiresApproval) {
        approvalCount++;
        rowOutcomes.push({ index: i, outcome: 'approval_pending' });
      } else {
        await inngest.send({
          name: BULK_PAYOUT_PROCESS_EVENT,
          data: {
            organizationId: context.organization.id,
            payoutId: payout.id,
            environment: context.merchant.environment as 'sandbox' | 'live',
            amount: row.amount,
            phone: row.phone,
            commandId: row.commandId ?? undefined,
            remarks: row.remarks ?? undefined,
            occasion: row.occasion ?? undefined,
          }
        });
        queuedCount++;
        rowOutcomes.push({ index: i, outcome: 'queued' });
      }
    }

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'payout.bulk_initiated',
      metadata: { totalRows: rows.length, queuedCount, approvalCount },
    });

    return NextResponse.json({ success: true, data: { queued: queuedCount, requiresApproval: approvalCount, outcomes: rowOutcomes } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Bulk Payout Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error while processing bulk payouts' }, { status: 500 });
  }
}
