import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { getOrganizationContext, updateMerchantForOrganization, type MerchantSettingsUpdate } from '@/lib/repositories/organizations';
import { logger } from '@/lib/logger';

export async function PATCH(request: Request) {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const context = await getOrganizationContext(userId, orgId);

    if (!context || !context.merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    const { organization } = context;
    const body = await request.json();

    const updateData: MerchantSettingsUpdate = {};

    if (body.environment !== undefined) {
      if (body.environment !== 'sandbox' && body.environment !== 'live') {
        return NextResponse.json({ success: false, error: 'Invalid environment value' }, { status: 400 });
      }
      // Going live is admin-gated: the org must have been approved for go-live
      // (liveApprovedAt set) before a merchant can toggle themselves to live.
      // Switching back to sandbox is always allowed.
      if (body.environment === 'live' && !organization.liveApprovedAt) {
        return NextResponse.json({ success: false, error: 'Live mode requires admin go-live approval. Request go-live once your KYC is approved and live credentials are added.' }, { status: 400 });
      }
      updateData.environment = body.environment;
    }

    if (body.webhookUrl !== undefined) {
      if (body.webhookUrl !== null) {
        try {
          const parsed = new URL(body.webhookUrl);
          if (parsed.protocol !== 'https:') {
            return NextResponse.json({ success: false, error: 'Webhook URL must use HTTPS protocol' }, { status: 400 });
          }
        } catch {
          return NextResponse.json({ success: false, error: 'Invalid Webhook URL format' }, { status: 400 });
        }
      }
      updateData.webhookUrl = body.webhookUrl;
    }

    if (body.shopifyShopDomain !== undefined) {
      if (body.shopifyShopDomain && !body.shopifyShopDomain.endsWith('.myshopify.com')) {
        return NextResponse.json({ success: false, error: 'Shopify Store Domain must end in .myshopify.com' }, { status: 400 });
      }
      updateData.shopifyShopDomain = body.shopifyShopDomain;
    }
    if (body.shopifyAdminAccessToken !== undefined) {
      updateData.shopifyAdminAccessToken = body.shopifyAdminAccessToken ? encryptSecret(body.shopifyAdminAccessToken) : null;
    }
    if (body.shopifyWebhookSecret !== undefined) {
      updateData.shopifyWebhookSecret = body.shopifyWebhookSecret ? encryptSecret(body.shopifyWebhookSecret) : null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    const updatedMerchant = await updateMerchantForOrganization(organization.id, updateData);

    return NextResponse.json({ 
      success: true, 
      data: {
        environment: updatedMerchant.environment,
        webhookUrl: updatedMerchant.webhookUrl,
        shopifyShopDomain: updatedMerchant.shopifyShopDomain,
        shopifyAdminAccessToken: updatedMerchant.shopifyAdminAccessToken ? decryptSecret(updatedMerchant.shopifyAdminAccessToken) : null,
        shopifyWebhookSecret: updatedMerchant.shopifyWebhookSecret ? decryptSecret(updatedMerchant.shopifyWebhookSecret) : null
      }
    }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Settings Update Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
