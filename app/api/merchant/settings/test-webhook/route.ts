import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { deliverWebhook } from '@/lib/webhook';
import { decryptSecret } from '@/lib/crypto';
import { recordDelivery } from '@/lib/repositories/webhook-deliveries';
import { WEBHOOK_EVENTS } from '@/lib/webhook-events';
import { logger } from '@/lib/logger';

/**
 * POST /api/merchant/settings/test-webhook — sends a synthetic `webhook.test`
 * event to the merchant's configured URL so they can verify their endpoint and
 * signature handling, and records the attempt like any real delivery.
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

    const { organization, merchant } = context;
    if (!merchant.webhookUrl) {
      return NextResponse.json({ success: false, error: 'No webhook URL configured' }, { status: 400 });
    }

    const payload = {
      event: WEBHOOK_EVENTS.WEBHOOK_TEST,
      data: {
        message: 'This is a test event from PaySwift.',
        transactionId: 'txn_test_' + crypto.randomBytes(8).toString('hex'),
        amount: 1000,
        phone: '254712345678',
        status: 'completed',
        mpesaReceipt: 'TEST' + crypto.randomBytes(4).toString('hex').toUpperCase(),
        timestamp: new Date().toISOString(),
      },
    };

    // BUG FIX: sign with the DECRYPTED secret (previously the encrypted blob was
    // passed straight through, so merchants could never verify the signature).
    const secret = merchant.webhookSecret ? decryptSecret(merchant.webhookSecret) ?? undefined : undefined;

    const result = await deliverWebhook(merchant.webhookUrl, payload, secret, {
      'x-payswift-event': WEBHOOK_EVENTS.WEBHOOK_TEST,
      'x-payswift-test': 'true',
    }, undefined, organization.id);

    await recordDelivery({
      organizationId: organization.id,
      event: WEBHOOK_EVENTS.WEBHOOK_TEST,
      url: merchant.webhookUrl,
      payload,
      statusCode: result.statusCode ?? null,
      success: result.delivered,
      attempt: result.attempts,
    });

    return NextResponse.json(
      { success: true, data: { statusCode: result.statusCode ?? null, delivered: result.delivered } },
      { status: 200 }
    );
  } catch (error: unknown) {
    logger.error('[Test Webhook Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Failed to deliver webhook payload to destination.' }, { status: 500 });
  }
}
