import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext, updateMerchantForOrganization } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

/**
 * Disconnects a Shopify store: clears the stored domain, access token and any
 * legacy per-merchant webhook secret. The webhook subscription on Shopify's side
 * is left in place (harmless — inbound events for an unknown domain 404), and
 * the merchant can uninstall the app from their Shopify admin to fully revoke.
 */
export async function POST() {
  try {
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

    await updateMerchantForOrganization(context.organization.id, {
      shopifyShopDomain: null,
      shopifyAdminAccessToken: null,
      shopifyWebhookSecret: null,
    });

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'shopify.disconnected',
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    logger.error('[Shopify Disconnect Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
