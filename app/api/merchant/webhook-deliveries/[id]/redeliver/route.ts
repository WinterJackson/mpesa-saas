import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { findDelivery, recordDelivery } from '@/lib/repositories/webhook-deliveries';
import { requireRole } from '@/lib/rbac';
import { deliverWebhook } from '@/lib/webhook';
import { decryptSecret } from '@/lib/crypto';
import { logger } from '@/lib/logger';

/**
 * POST /api/merchant/webhook-deliveries/[id]/redeliver — re-sends a past
 * (typically failed/dead-lettered) webhook using its stored payload to the
 * merchant's CURRENT webhook URL/secret, and records a fresh delivery attempt.
 * Owner/admin only.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const rbac = await requireRole(context.organization.id, userId, ['owner', 'admin']);
    if (!rbac.allowed) {
      return NextResponse.json({ success: false, error: rbac.error }, { status: rbac.status });
    }

    const delivery = await findDelivery(context.organization.id, id);
    if (!delivery) {
      return NextResponse.json({ success: false, error: 'Delivery not found' }, { status: 404 });
    }

    const { merchant } = context;
    if (!merchant.webhookUrl) {
      return NextResponse.json({ success: false, error: 'No webhook URL configured' }, { status: 400 });
    }

    const secret = merchant.webhookSecret ? decryptSecret(merchant.webhookSecret) ?? undefined : undefined;
    const result = await deliverWebhook(
      merchant.webhookUrl,
      delivery.payload as Record<string, unknown>,
      secret,
      { 'x-payswift-redelivery': 'true' }
    );

    await recordDelivery({
      organizationId: context.organization.id,
      event: delivery.event ?? 'unknown',
      transactionId: delivery.resourceType === 'transaction' ? delivery.resourceId : null,
      payoutId: delivery.resourceType === 'payout' ? delivery.resourceId : null,
      refundId: delivery.resourceType === 'refund' ? delivery.resourceId : null,
      url: merchant.webhookUrl,
      payload: delivery.payload,
      statusCode: result.statusCode ?? null,
      success: result.delivered,
      attempt: result.attempts,
    });

    return NextResponse.json(
      { success: true, data: { delivered: result.delivered, statusCode: result.statusCode ?? null } },
      { status: 200 }
    );
  } catch (error: unknown) {
    logger.error('[Webhook Redeliver Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
