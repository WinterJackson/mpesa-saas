import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import {
  createDeletionRequest,
  hasPendingDeletionRequest,
  listDeletionRequestsForOrganization,
} from '@/lib/repositories/data-deletion-requests';
import { logger } from '@/lib/logger';

/**
 * POST /api/merchant/data-deletion-request — Kenya DPA right-to-erasure
 * groundwork (Phase 4, Stage 9). Records an admin-reviewed deletion request;
 * it NEVER auto-executes deletion, because financial record-retention
 * obligations (AML/POCAMLA) conflict with blanket erasure. Owner only.
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

    // Deleting an organization's data is an owner-level decision.
    const rbac = await requireRole(context.organization.id, userId, ['owner']);
    if (!rbac.allowed) {
      return NextResponse.json({ success: false, error: rbac.error }, { status: rbac.status });
    }

    if (await hasPendingDeletionRequest(context.organization.id)) {
      return NextResponse.json(
        { success: false, error: 'A data-deletion request is already pending review for this organization.' },
        { status: 409 }
      );
    }

    let reason: string | null = null;
    try {
      const body = await request.json();
      if (typeof body?.reason === 'string') reason = body.reason.slice(0, 1000);
    } catch {
      // Body is optional.
    }

    const created = await createDeletionRequest(context.organization.id, userId, reason);

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'data.deletion_requested',
      metadata: { requestId: created.id },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: created.id,
          status: created.status,
          message:
            'Your data-deletion request has been submitted for review. Deletion is not automatic — our team will review it against financial record-retention obligations and follow up.',
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error('[Data Deletion Request Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/** GET — the requesting org's own deletion-request history (owner/admin). */
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

    const requests = await listDeletionRequestsForOrganization(context.organization.id);
    return NextResponse.json({ success: true, data: requests }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Data Deletion Request List Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
