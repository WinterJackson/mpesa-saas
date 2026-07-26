import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { rejectPayout } from '@/lib/payouts';
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

    let body;
    try {
      body = await request.json();
    } catch {
      // reason is optional, so invalid json is fine if missing
      body = {};
    }

    const { id } = await params;
    const result = await rejectPayout(context.organization.id, id, userId, body.reason);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'payout.rejected',
      metadata: { payoutId: id, reason: body.reason },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[Payout Reject Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
