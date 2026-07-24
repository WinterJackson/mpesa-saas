import { inngest, isInngestConfigured, WEBHOOK_DELIVER_EVENT, type WebhookDeliverEventData } from '@/lib/inngest';
import { deliverWebhook } from '@/lib/webhook';
import { recordDelivery } from '@/lib/repositories/webhook-deliveries';
import { logger } from '@/lib/logger';

export type DispatchWebhookInput = WebhookDeliverEventData;

/**
 * Delivers a webhook and records the attempt — the single call every
 * finalization/test/redelivery site should use. Routes through Inngest for
 * durability across process boundaries when configured (Phase 4, Stage 5):
 * an Inngest-executed step survives the originating serverless invocation
 * crashing or timing out, unlike a plain in-request retry loop. Falls back
 * to the direct in-request delivery — unchanged from before this stage —
 * when Inngest isn't configured (lib/inngest-functions.ts's
 * deliverWebhookFn does the same recordDelivery call on the Inngest path).
 */
export async function dispatchWebhook(input: DispatchWebhookInput): Promise<void> {
  if (isInngestConfigured()) {
    await inngest.send({ name: WEBHOOK_DELIVER_EVENT, data: input });
    return;
  }

  const result = await deliverWebhook(input.url, input.payload, input.secret, input.headers, undefined, input.organizationId);

  await recordDelivery({
    organizationId: input.organizationId,
    event: input.event,
    transactionId: input.transactionId ?? null,
    payoutId: input.payoutId ?? null,
    refundId: input.refundId ?? null,
    url: input.url,
    payload: input.payload,
    statusCode: result.statusCode ?? null,
    success: result.delivered,
    attempt: result.attempts,
  });

  if (!result.delivered) {
    logger.warn(`[Webhook Dispatch] Delivery failed to ${input.url} (HTTP ${result.statusCode})`);
  }
}
