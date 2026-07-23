import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext, setLiveRequested } from '@/lib/repositories/organizations';
import { isLiveCredentialConfigured } from '@/lib/repositories/daraja-credentials';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * POST /api/merchant/go-live/request — a merchant asks to go live. Gated on
 * KYC approved + live Daraja credentials present. Owner/admin only. Sets
 * liveRequestedAt so the org appears in the admin go-live queue; the actual
 * flip to live requires admin approval (app/api/admin/organizations/[id]/go-live).
 */
export async function POST() {
  try {
    const { userId, orgId } = await auth();
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const context = await getOrganizationContext(userId, orgId);
    if (!context) return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });

    const rbac = await requireRole(context.organization.id, userId, ['owner', 'admin']);
    if (!rbac.allowed) return NextResponse.json({ success: false, error: rbac.error }, { status: rbac.status });

    if (context.organization.liveApprovedAt) {
      return NextResponse.json({ success: false, error: 'This organization is already approved for live mode' }, { status: 400 });
    }
    if (context.organization.kycStatus !== 'approved') {
      return NextResponse.json({ success: false, error: 'KYC must be approved before requesting go-live' }, { status: 400 });
    }
    if (!(await isLiveCredentialConfigured(context.organization.id))) {
      return NextResponse.json({ success: false, error: 'Add your live Daraja credentials before requesting go-live' }, { status: 400 });
    }

    await setLiveRequested(context.organization.id);
    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'organization.go_live_requested',
    });

    return NextResponse.json({ success: true, data: { status: 'requested' } }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Go-Live Request Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
