import { inngest, WEBHOOK_DELIVER_EVENT, type WebhookDeliverEventData } from '@/lib/inngest';
import { deliverWebhook } from '@/lib/webhook';
import { recordDelivery } from '@/lib/repositories/webhook-deliveries';

/**
 * Handler logic for a durable webhook delivery (Phase 4, Stage 5), exported
 * separately from the Inngest function wrapper below so it's directly unit
 * testable without Inngest's own test harness.
 */
export async function handleWebhookDeliver({ event }: { event: { data: WebhookDeliverEventData } }) {
  const data = event.data;
  const result = await deliverWebhook(data.url, data.payload, data.secret, data.headers, undefined, data.organizationId);

  await recordDelivery({
    organizationId: data.organizationId,
    event: data.event,
    transactionId: data.transactionId ?? null,
    payoutId: data.payoutId ?? null,
    refundId: data.refundId ?? null,
    url: data.url,
    payload: data.payload,
    statusCode: result.statusCode ?? null,
    success: result.delivered,
    attempt: result.attempts,
  });

  return result;
}

/**
 * Inngest retries this function's execution if the whole invocation fails/
 * crashes/times out — durability ACROSS process boundaries, on top of (not
 * instead of) deliverWebhook's own existing 3-attempt HTTP retry within one
 * execution.
 */
export const deliverWebhookFn = inngest.createFunction(
  { id: 'webhook-deliver', retries: 2, triggers: [{ event: WEBHOOK_DELIVER_EVENT }] },
  handleWebhookDeliver
);

export const inngestFunctions = [deliverWebhookFn];
