import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

const INVITABLE_ROLES = ['admin', 'developer', 'finance'];

/**
 * POST /api/merchant/team/invite
 *
 * Creates a Clerk Organization invitation. The invitee is given Clerk's
 * default "org:member" role — Membership.role (our own RBAC, see
 * lib/rbac.ts) is carried in the invitation's publicMetadata.payswiftRole,
 * which Clerk copies onto the resulting membership on acceptance and
 * app/api/webhooks/clerk/route.ts reads to create the local Membership row.
 */
export async function POST(request: Request) {
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

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { email, role } = body;
    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'A valid email is required' }, { status: 400 });
    }
    if (typeof role !== 'string' || !INVITABLE_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: `role must be one of: ${INVITABLE_ROLES.join(', ')}` }, { status: 400 });
    }

    const client = await clerkClient();
    await client.organizations.createOrganizationInvitation({
      organizationId: context.organization.clerkOrgId,
      emailAddress: email,
      inviterUserId: userId,
      role: 'org:member',
      publicMetadata: { payswiftRole: role },
    });

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'team.invited',
      metadata: { email, role },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Team Invite Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
