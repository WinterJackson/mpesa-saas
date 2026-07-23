import { NextResponse, after } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyShopifyWebhook, getShopifyAppConfig } from '@/lib/shopify';
import { createAndInitiatePayment } from '@/lib/payments';
import { decryptSecret } from '@/lib/crypto';
import { validatePhone } from '@/lib/validation';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
    const shopDomainHeader = request.headers.get('x-shopify-shop-domain');
    const topicHeader = request.headers.get('x-shopify-topic');

    if (!hmacHeader || !shopDomainHeader || !topicHeader) {
      return NextResponse.json({ success: false, error: 'Missing Shopify headers' }, { status: 400 });
    }

    const merchant = await prisma.merchant.findFirst({
      where: { shopifyShopDomain: shopDomainHeader }
    });

    if (!merchant) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    if (!merchant.organizationId) {
      logger.error(`[Shopify] Merchant ${merchant.id} has no organizationId — Organization backfill has not run`);
      return NextResponse.json({ success: false, error: 'Account setup incomplete' }, { status: 500 });
    }

    // Verify the webhook HMAC. Merchants connected via the one-click OAuth app
    // are verified with the platform app's shared secret (SHOPIFY_CLIENT_SECRET);
    // merchants who registered manually before OAuth existed keep working via
    // their own per-merchant shopifyWebhookSecret. Either matching is sufficient.
    const appSecret = getShopifyAppConfig()?.clientSecret;
    const perMerchantSecret = merchant.shopifyWebhookSecret
      ? decryptSecret(merchant.shopifyWebhookSecret)
      : null;

    const verified =
      (appSecret && verifyShopifyWebhook(rawBody, hmacHeader, appSecret)) ||
      (perMerchantSecret && verifyShopifyWebhook(rawBody, hmacHeader, perMerchantSecret));

    if (!verified) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (topicHeader !== 'orders/create') {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    let order;
    try {
      order = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const shopifyOrderId = order.id;
    const shopifyOrderName = order.name;

    if (order.currency !== 'KES') {
      logger.warn(`[Shopify] Skipping non-KES order ${shopifyOrderName} (${shopifyOrderId})`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const phoneRaw = order.phone || order.customer?.phone || order.shipping_address?.phone;
    if (!phoneRaw) {
      logger.warn(`[Shopify] Skipping order ${shopifyOrderName} (${shopifyOrderId}) - missing phone`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const phoneValidation = validatePhone(String(phoneRaw));
    if (!phoneValidation.valid) {
      logger.warn(`[Shopify] Skipping order ${shopifyOrderName} (${shopifyOrderId}) - invalid phone: ${phoneValidation.error}`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    const amountKes = Math.round(Number(order.total_price));

    after(async () => {
      try {
        const result = await createAndInitiatePayment({
          merchant,
          organizationId: merchant.organizationId!,
          phone: phoneValidation.sanitized!,
          amount: amountKes,
          orderReference: String(shopifyOrderId), // Store numeric ID for update later
          source: 'shopify',
        });

        if (!result.success) {
          logger.error(`[Shopify] Payment initiation failed for order ${shopifyOrderName}: ${result.error}`);
        } else {
          logger.info(`[Shopify] Initiated M-Pesa STK push for order ${shopifyOrderName} (${shopifyOrderId})`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`[Shopify] Background processing error for order ${shopifyOrderName}: ${msg}`);
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Shopify Webhook Error]:', message);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
