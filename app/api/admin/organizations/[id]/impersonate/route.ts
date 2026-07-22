import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { requireAdmin } from '@/lib/admin-auth';
import { findOrganizationById } from '@/lib/repositories/organizations';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/organizations/[id]/impersonate
 *
 * Support-impersonation entry point (master plan Section 4.6). Every call
 * writes an AuditLog row before anything else — impersonation must never
 * ship without an audit trail.
 *
 * Scope note: this does not yet exchange for a real Clerk session token
 * acting as the organization's owner — that requires Clerk's User
 * Impersonation feature, which needs its own Dashboard configuration this
 * phase didn't confirm is enabled. Documented here as a deliberate scope
 * limitation (mirrors this phase's RLS deferral) rather than a silently
 * half-built feature: the entry point and audit trail exist now; the actual
 * session hand-off is a follow-up once Clerk impersonation is configured.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const adminAuth = await requireAdmin(userId, ['superadmin']);
    if (!adminAuth.allowed) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.status });
    }

    const { id } = await params;
    const organization = await findOrganizationById(id);
    if (!organization) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    await writeAuditLog({
      organizationId: organization.id,
      actorId: userId,
      action: 'admin.impersonated',
      metadata: { organizationBusinessName: organization.businessName },
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Impersonation session hand-off is not yet wired up (requires Clerk User Impersonation to be configured). This action has been recorded in the audit log.',
      },
      { status: 501 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Admin Impersonate Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
