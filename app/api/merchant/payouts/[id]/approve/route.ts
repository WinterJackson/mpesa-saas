import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { approvePayout } from '@/lib/payouts';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const context = await getOrganizationContext(userId, orgId);
    if (!context || !context.merchant) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    const { id } = await params;
    const result = await approvePayout(context.organization.id, id, userId);

    if (!result.success) {
      // Return 400 for logic failures (e.g. self-approval block) or 502 for Daraja errors
      const status = result.error.includes('cannot approve') || result.error.includes('pending') ? 400 : 502;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'payout.approved',
      metadata: { payoutId: id },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[Payout Approve Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
