import { NextResponse, after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { buildDataExport } from '@/lib/data-export';
import { notifyDataExportReady } from '@/lib/email/notifications';
import { logger } from '@/lib/logger';

/**
 * GET /api/merchant/data-export — Kenya DPA right-of-access groundwork
 * (Phase 4, Stage 9). Returns the organization's OWN data (profile,
 * transactions, payouts, refunds, webhook deliveries, team) as a
 * downloadable JSON file. Owner/admin only. Never includes secret material
 * (key hashes, encrypted credentials, webhook secrets).
 */
export async function GET() {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const context = await getOrganizationContext(userId, orgId);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    const rbac = await requireRole(context.organization.id, userId, ['owner', 'admin']);
    if (!rbac.allowed) {
      return NextResponse.json({ success: false, error: rbac.error }, { status: rbac.status });
    }

    const data = await buildDataExport(context.organization, context.merchant);

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'data.exported',
    });

    // Security notice that a personal-data export was generated (DPA audit trail).
    after(() => notifyDataExportReady(context.organization.id));

    return new NextResponse(JSON.stringify({ success: true, data }, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="payswift-data-export-${context.organization.id}.json"`,
      },
    });
  } catch (error: unknown) {
    logger.error('[Data Export Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
