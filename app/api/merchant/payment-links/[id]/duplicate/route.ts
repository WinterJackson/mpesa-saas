import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { duplicatePaymentLink } from '@/lib/repositories/payment-links';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

// Clone an existing payment link into a fresh active link (owner/admin/developer).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { userId, orgId } = await auth();
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const context = await getOrganizationContext(userId, orgId);
    if (!context || !context.merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    const rbac = await requireRole(context.organization.id, userId, ['owner', 'admin', 'developer']);
    if (!rbac.allowed) return NextResponse.json({ success: false, error: rbac.error }, { status: rbac.status });

    const link = await duplicatePaymentLink(context.organization.id, id);
    if (!link) return NextResponse.json({ success: false, error: 'Payment link not found' }, { status: 404 });

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'payment_link.duplicated',
      metadata: { sourcePaymentLinkId: id, paymentLinkId: link.id },
    });

    return NextResponse.json({ success: true, data: link }, { status: 201 });
  } catch (error: unknown) {
    logger.error('[Payment Link Duplicate Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
