import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { deactivatePaymentLink } from '@/lib/repositories/payment-links';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

// Deactivate a payment link (soft — the record and its past payments are kept;
// the public /pay/[slug] page stops resolving it via findActiveLinkBySlug).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const context = await getOrganizationContext(userId, orgId);
    if (!context || !context.merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    const rbac = await requireRole(context.organization.id, userId, ['owner', 'admin', 'developer']);
    if (!rbac.allowed) {
      return NextResponse.json({ success: false, error: rbac.error }, { status: rbac.status });
    }

    const link = await deactivatePaymentLink(context.organization.id, id);
    if (!link) {
      return NextResponse.json({ success: false, error: 'Payment link not found' }, { status: 404 });
    }

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'payment_link.deactivated',
      metadata: { paymentLinkId: id },
    });

    return NextResponse.json({ success: true, data: link }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Payment Link Deactivate Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
