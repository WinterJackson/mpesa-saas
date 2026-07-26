import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext, updatePayoutApprovalThreshold } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

export async function PATCH(request: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const context = await getOrganizationContext(userId, orgId);
    if (!context || !context.merchant) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    // Explicitly exclude finance per the plan
    const rbac = await requireRole(context.organization.id, userId, ['owner', 'admin']);
    if (!rbac.allowed) {
      return NextResponse.json({ success: false, error: rbac.error }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    let thresholdKes: number | null = null;
    if (body.thresholdKes !== undefined && body.thresholdKes !== null && body.thresholdKes !== '') {
      thresholdKes = Number(body.thresholdKes);
      if (isNaN(thresholdKes) || thresholdKes < 0) {
        return NextResponse.json({ success: false, error: 'Invalid threshold amount' }, { status: 400 });
      }
    }

    await updatePayoutApprovalThreshold(context.organization.id, thresholdKes);

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'organization.settings.payout_threshold.updated',
      metadata: { thresholdKes },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[Payout Approval Settings Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
