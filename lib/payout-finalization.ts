import { after } from 'next/server';
import { deliverWebhook } from '@/lib/webhook';
import { decryptSecret } from '@/lib/crypto';
import { recordDelivery } from '@/lib/repositories/webhook-deliveries';
import { payoutEvent, refundEvent } from '@/lib/webhook-events';
import type { Payout, Refund, Merchant } from '@prisma/client';
import { logger } from '@/lib/logger';

// Fires the outbound webhook for a concluded payout/refund and records the
// delivery on the polymorphic WebhookDelivery (payoutId/refundId). Mirrors
// finalizeTransactionAsync — fire-and-forget via after(), never throws.

export function finalizePayoutAsync(payout: Payout, merchant: Merchant) {
  if (!merchant.webhookUrl) return;

  const event = payoutEvent(payout.status);
  const webhookPayload = {
    event,
    data: {
      payoutId: payout.id,
      amount: payout.amount,
      phone: payout.phone,
      commandId: payout.commandId,
      status: payout.status,
      mpesaReceipt: payout.mpesaReceipt,
      resultCode: payout.resultCode,
      resultDesc: payout.resultDesc,
      createdAt: payout.createdAt,
      updatedAt: payout.updatedAt,
    },
  };

  after(async () => {
    try {
      const secret = merchant.webhookSecret ? decryptSecret(merchant.webhookSecret) ?? undefined : undefined;
      const result = await deliverWebhook(merchant.webhookUrl!, webhookPayload, secret, undefined, undefined, payout.organizationId);
      await recordDelivery({
        organizationId: payout.organizationId,
        event,
        payoutId: payout.id,
        url: merchant.webhookUrl!,
        payload: webhookPayload,
        statusCode: result.statusCode ?? null,
        success: result.delivered,
        attempt: result.attempts,
      });
      if (!result.delivered) {
        logger.warn(`[Finalize Payout Webhook] Delivery failed to ${merchant.webhookUrl} (HTTP ${result.statusCode})`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`[Finalize Payout Webhook] Uncaught error for ${merchant.webhookUrl}: ${msg}`);
    }
  });
}

export function finalizeRefundAsync(refund: Refund, merchant: Merchant) {
  if (!merchant.webhookUrl) return;

  const event = refundEvent(refund.status);
  const webhookPayload = {
    event,
    data: {
      refundId: refund.id,
      transactionId: refund.transactionId,
      amount: refund.amount,
      phone: refund.phone,
      status: refund.status,
      mpesaReceipt: refund.mpesaReceipt,
      resultCode: refund.resultCode,
      resultDesc: refund.resultDesc,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
    },
  };

  after(async () => {
    try {
      const secret = merchant.webhookSecret ? decryptSecret(merchant.webhookSecret) ?? undefined : undefined;
      const result = await deliverWebhook(merchant.webhookUrl!, webhookPayload, secret, undefined, undefined, refund.organizationId);
      await recordDelivery({
        organizationId: refund.organizationId,
        event,
        refundId: refund.id,
        url: merchant.webhookUrl!,
        payload: webhookPayload,
        statusCode: result.statusCode ?? null,
        success: result.delivered,
        attempt: result.attempts,
      });
      if (!result.delivered) {
        logger.warn(`[Finalize Refund Webhook] Delivery failed to ${merchant.webhookUrl} (HTTP ${result.statusCode})`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error(`[Finalize Refund Webhook] Uncaught error for ${merchant.webhookUrl}: ${msg}`);
    }
  });
}
