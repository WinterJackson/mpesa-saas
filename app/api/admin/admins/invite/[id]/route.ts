import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import { deleteAdminInvite } from '@/lib/repositories/admin';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * DELETE /api/admin/admins/invite/[id] — revoke a pending admin invite.
 * `admin:manage` (superadmin) only. After this the invitee can no longer be
 * auto-promoted on sign-in (no matching pending invite remains).
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const adminAuth = await requireAdminCapability(userId, 'admin:manage');
    if (!adminAuth.allowed) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.status });
    }

    const { id } = await params;
    await deleteAdminInvite(id);

    await writeAuditLog({
      actorId: userId,
      action: 'admin_invite.revoked',
      metadata: { inviteId: id },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Admin Invite Revoke Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
