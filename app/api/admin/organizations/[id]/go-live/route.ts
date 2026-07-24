import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import { findOrganizationById, approveGoLive } from '@/lib/repositories/organizations';
import { isLiveCredentialConfigured } from '@/lib/repositories/daraja-credentials';
import { getAccessToken } from '@/lib/daraja';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/organizations/[id]/go-live — superadmin approves an org for
 * live mode. Re-checks KYC approved + live credentials present, then VALIDATES
 * the live credentials against Safaricom (a live getAccessToken) before flipping
 * the org + merchant to live and stamping liveApprovedAt/By.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const adminAuth = await requireAdminCapability(userId, 'org:golive');
    if (!adminAuth.allowed) return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.status });

    const { id } = await params;
    const organization = await findOrganizationById(id);
    if (!organization) return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });

    if (organization.liveApprovedAt) {
      return NextResponse.json({ success: false, error: 'Organization is already approved for live mode' }, { status: 400 });
    }
    if (organization.kycStatus !== 'approved') {
      return NextResponse.json({ success: false, error: 'KYC is not approved for this organization' }, { status: 400 });
    }
    if (!(await isLiveCredentialConfigured(id))) {
      return NextResponse.json({ success: false, error: 'The organization has not configured live Daraja credentials' }, { status: 400 });
    }

    // Validate the live credentials against Safaricom before flipping.
    try {
      await getAccessToken(id, 'live');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'validation failed';
      return NextResponse.json({ success: false, error: `Live credentials failed validation with Safaricom: ${msg}` }, { status: 502 });
    }

    await approveGoLive(id, userId);
    await writeAuditLog({
      organizationId: id,
      actorId: userId,
      action: 'organization.live_approved',
      metadata: { approvedBy: userId },
    });

    return NextResponse.json({ success: true, data: { environment: 'live' } }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Admin Go-Live Approve Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
