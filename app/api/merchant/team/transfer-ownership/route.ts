import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getOrganizationContext, findMembership, transferOwnership } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * POST /api/merchant/team/transfer-ownership
 *
 * Hands the organization over to another member. OWNER ONLY. The current owner
 * is demoted to `admin` and the target member becomes the new `owner`, keeping
 * exactly one owner. Deliberately a dedicated path — the normal team role-change
 * route refuses to touch the owner role at all.
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

    // Only the current owner can transfer ownership — not even an admin.
    const rbac = await requireRole(context.organization.id, userId, ['owner']);
    if (!rbac.allowed) {
      return NextResponse.json({ success: false, error: rbac.error }, { status: rbac.status });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const newOwnerClerkUserId = body.clerkUserId;
    if (typeof newOwnerClerkUserId !== 'string' || newOwnerClerkUserId.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'clerkUserId is required' }, { status: 400 });
    }
    if (newOwnerClerkUserId === userId) {
      return NextResponse.json({ success: false, error: 'You are already the owner.' }, { status: 400 });
    }

    const target = await findMembership(context.organization.id, newOwnerClerkUserId);
    if (!target) {
      return NextResponse.json({ success: false, error: 'That person is not a member of this organization.' }, { status: 404 });
    }

    // Mirror the new roles into Clerk org membership metadata (payswiftRole), then
    // atomically swap the local roles. Clerk updates first so a mid-way failure
    // leaves Clerk ahead of the DB (harmless — the webhook/reconcile re-syncs)
    // rather than the reverse.
    const client = await clerkClient();
    await client.organizations.updateOrganizationMembershipMetadata({
      organizationId: context.organization.clerkOrgId,
      userId: newOwnerClerkUserId,
      publicMetadata: { payswiftRole: 'owner' },
    });
    await client.organizations.updateOrganizationMembershipMetadata({
      organizationId: context.organization.clerkOrgId,
      userId,
      publicMetadata: { payswiftRole: 'admin' },
    });

    await transferOwnership(context.organization.id, userId, newOwnerClerkUserId);

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'team.ownership_transferred',
      metadata: { newOwnerClerkUserId, previousOwnerClerkUserId: userId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Transfer Ownership Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
