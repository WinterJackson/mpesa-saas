import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import { adminFindPayoutById } from '@/lib/repositories/payouts';
import { reverseTransaction } from '@/lib/daraja-reversal';
import { createDarajaCommand } from '@/lib/repositories/daraja-commands';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/payouts/[id]/reverse — reverses a completed payout by its
 * M-Pesa receipt. Superadmin-only (money-moving ops action). The outcome
 * arrives asynchronously at the reversal result callback, which flips the payout
 * to 'reversed'.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const adminAuth = await requireAdminCapability(userId, 'payout:reverse');
    if (!adminAuth.allowed) return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.status });

    const { id } = await params;
    const payout = await adminFindPayoutById(id);
    if (!payout) return NextResponse.json({ success: false, error: 'Payout not found' }, { status: 404 });
    if (payout.status !== 'completed') {
      return NextResponse.json({ success: false, error: 'Only completed payouts can be reversed' }, { status: 400 });
    }
    if (!payout.mpesaReceipt) {
      return NextResponse.json({ success: false, error: 'Payout has no M-Pesa receipt to reverse' }, { status: 400 });
    }

    try {
      const res = await reverseTransaction({
        organizationId: payout.organizationId,
        environment: payout.environment as 'sandbox' | 'live',
        transactionReceipt: payout.mpesaReceipt,
        amount: payout.amount,
        remarks: 'Admin reversal',
      });
      await createDarajaCommand(payout.organizationId, {
        type: 'reversal',
        environment: payout.environment,
        originatorConversationId: res.OriginatorConversationID,
        conversationId: res.ConversationID,
        targetReceipt: payout.mpesaReceipt,
        targetPayoutId: payout.id,
      });
      await writeAuditLog({
        organizationId: payout.organizationId,
        actorId: userId,
        action: 'payout.reversal_requested',
        metadata: { payoutId: payout.id, amount: payout.amount },
      });
      return NextResponse.json({ success: true, data: { status: 'queued' } }, { status: 202 });
    } catch (err: unknown) {
      return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Reversal failed' }, { status: 502 });
    }
  } catch (error: unknown) {
    logger.error('[Admin Payout Reverse Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
