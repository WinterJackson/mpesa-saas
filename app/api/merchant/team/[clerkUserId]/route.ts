import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getOrganizationContext, findMembership, updateMembershipRole, removeMembership } from '@/lib/repositories/organizations';
import { requireRole, type Role } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

const ASSIGNABLE_ROLES: Role[] = ['admin', 'developer', 'finance'];

export async function PATCH(request: Request, { params }: { params: Promise<{ clerkUserId: string }> }) {
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

    const { clerkUserId } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { role } = body;
    if (typeof role !== 'string' || !ASSIGNABLE_ROLES.includes(role as Role)) {
      return NextResponse.json({ success: false, error: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` }, { status: 400 });
    }

    const target = await findMembership(context.organization.id, clerkUserId);
    if (!target) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 });
    }
    if (target.role === 'owner') {
      return NextResponse.json({ success: false, error: "The organization owner's role cannot be changed here" }, { status: 400 });
    }

    const client = await clerkClient();
    await client.organizations.updateOrganizationMembershipMetadata({
      organizationId: context.organization.clerkOrgId,
      userId: clerkUserId,
      publicMetadata: { payswiftRole: role },
    });

    const updated = await updateMembershipRole(context.organization.id, clerkUserId, role);

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'team.role_changed',
      metadata: { targetClerkUserId: clerkUserId, newRole: role },
    });

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Team Role Change Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ clerkUserId: string }> }) {
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

    const { clerkUserId } = await params;

    const target = await findMembership(context.organization.id, clerkUserId);
    if (!target) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 });
    }
    if (target.role === 'owner') {
      return NextResponse.json({ success: false, error: 'The organization owner cannot be removed' }, { status: 400 });
    }

    const client = await clerkClient();
    await client.organizations.deleteOrganizationMembership({
      organizationId: context.organization.clerkOrgId,
      userId: clerkUserId,
    });

    await removeMembership(context.organization.id, clerkUserId);

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'team.member_removed',
      metadata: { targetClerkUserId: clerkUserId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Team Remove Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
