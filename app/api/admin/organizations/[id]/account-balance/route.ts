import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { requireAdmin } from '@/lib/admin-auth';
import { findOrganizationById } from '@/lib/repositories/organizations';
import { queryAccountBalance } from '@/lib/daraja-account-balance';
import { createDarajaCommand } from '@/lib/repositories/daraja-commands';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/organizations/[id]/account-balance — queues an Account Balance
 * query for the org's active environment. The balance arrives asynchronously at
 * the result callback and is snapshotted for ops review. Admin-only.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const adminAuth = await requireAdmin(userId);
    if (!adminAuth.allowed) return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.status });

    const { id } = await params;
    const organization = await findOrganizationById(id);
    if (!organization) return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });

    const environment = organization.environment as 'sandbox' | 'live';
    try {
      const res = await queryAccountBalance({ organizationId: organization.id, environment });
      await createDarajaCommand(organization.id, {
        type: 'account_balance',
        environment,
        originatorConversationId: res.OriginatorConversationID,
        conversationId: res.ConversationID,
      });
      await writeAuditLog({ organizationId: organization.id, actorId: userId, action: 'account_balance.queried', metadata: { environment } });
      return NextResponse.json({ success: true, data: { status: 'queued' } }, { status: 202 });
    } catch (err: unknown) {
      return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Query failed' }, { status: 502 });
    }
  } catch (error: unknown) {
    logger.error('[Admin Account Balance Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
