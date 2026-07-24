import { NextResponse, after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { createKycDocument, listKycDocuments } from '@/lib/repositories/kyc-documents';
import { uploadKycDocument } from '@/lib/storage';
import { notifyKycSubmitted } from '@/lib/email/notifications';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

const ALLOWED_TYPES = ['id', 'business_registration', 'kra_pin'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

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

    const documents = await listKycDocuments(context.organization.id);
    return NextResponse.json({ success: true, data: documents }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[KYC List Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

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

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ success: false, error: 'Expected multipart/form-data' }, { status: 400 });
    }

    const documentType = formData.get('type');
    const file = formData.get('file');

    if (typeof documentType !== 'string' || !ALLOWED_TYPES.includes(documentType)) {
      return NextResponse.json(
        { success: false, error: `type must be one of: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'file is required' }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ success: false, error: 'File exceeds the 10MB limit' }, { status: 400 });
    }

    const data = Buffer.from(await file.arrayBuffer());
    const { storageKey } = await uploadKycDocument({
      organizationId: context.organization.id,
      documentType,
      contentType: file.type || 'application/octet-stream',
      data,
    });

    const document = await createKycDocument(context.organization.id, {
      type: documentType,
      storageKey,
    });

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'kyc_document.submitted',
      metadata: { documentType, documentId: document.id },
    });

    // Confirm to the merchant + alert KYC reviewers (fire-and-forget).
    after(() => notifyKycSubmitted(context.organization.id, documentType));

    return NextResponse.json({ success: true, data: document }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[KYC Upload Error]:', message);
    if (message.includes('R2 storage is not configured')) {
      return NextResponse.json(
        { success: false, error: 'Document storage is not yet configured on this platform. Contact support.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
