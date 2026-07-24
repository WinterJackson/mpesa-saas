import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { requireAdminCapability } from '@/lib/admin-auth';
import { updateKycDocumentReviewStatus, allRequiredDocumentsApproved } from '@/lib/repositories/kyc-documents';
import { updateOrganizationKycStatus } from '@/lib/repositories/admin';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const adminAuth = await requireAdminCapability(userId, 'kyc:review');
    if (!adminAuth.allowed) {
      return NextResponse.json({ success: false, error: adminAuth.error }, { status: adminAuth.status });
    }

    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { organizationId, reviewStatus } = body;

    if (typeof organizationId !== 'string') {
      return NextResponse.json({ success: false, error: 'organizationId is required' }, { status: 400 });
    }
    if (reviewStatus !== 'approved' && reviewStatus !== 'rejected') {
      return NextResponse.json({ success: false, error: 'reviewStatus must be "approved" or "rejected"' }, { status: 400 });
    }

    const document = await updateKycDocumentReviewStatus(organizationId, id, reviewStatus);

    await writeAuditLog({
      organizationId,
      actorId: userId,
      action: reviewStatus === 'approved' ? 'kyc_document.approved' : 'kyc_document.rejected',
      metadata: { documentId: id, documentType: document.type },
    });

    if (reviewStatus === 'approved' && (await allRequiredDocumentsApproved(organizationId))) {
      await updateOrganizationKycStatus(organizationId, 'approved');
      await writeAuditLog({
        organizationId,
        actorId: userId,
        action: 'organization.kyc_approved',
      });
    }

    if (reviewStatus === 'rejected') {
      await updateOrganizationKycStatus(organizationId, 'rejected');
    }

    return NextResponse.json({ success: true, data: document }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Admin KYC Review Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
