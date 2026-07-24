import { after } from 'next/server';
import { dispatchWebhook } from '@/lib/webhook-dispatch';
import { markShopifyOrderPaid } from '@/lib/shopify';
import { decryptSecret } from '@/lib/crypto';
import { paymentEvent } from '@/lib/webhook-events';
import type { Transaction, Merchant } from '@prisma/client';
import { logger } from '@/lib/logger';

export function finalizeTransactionAsync(
  updatedTransaction: Transaction,
  merchant: Merchant
) {
  // ── 1. Outbound Webhook (Fire-and-Forget) ─────────────────────────────────
  if (merchant.webhookUrl) {
    const event = paymentEvent(updatedTransaction.status);
    const webhookPayload = {
      event,
      data: {
        transactionId: updatedTransaction.id,
        amount: updatedTransaction.amount,
        phone: updatedTransaction.phone,
        orderReference: updatedTransaction.orderReference,
        status: updatedTransaction.status,
        mpesaReceipt: updatedTransaction.mpesaReceipt,
        resultCode: updatedTransaction.resultCode,
        resultDesc: updatedTransaction.resultDesc,
        createdAt: updatedTransaction.createdAt,
        updatedAt: updatedTransaction.updatedAt,
      },
    };

    after(async () => {
      try {
        const secret = merchant.webhookSecret ? decryptSecret(merchant.webhookSecret) ?? undefined : undefined;
        await dispatchWebhook({
          organizationId: updatedTransaction.organizationId,
          event,
          transactionId: updatedTransaction.id,
          url: merchant.webhookUrl!,
          payload: webhookPayload,
          secret,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`[Finalize Webhook] Uncaught error for ${merchant.webhookUrl}: ${msg}`);
      }
    });
  }

  // ── 2. Outbound Shopify Confirmation (Fire-and-Forget) ────────────────────
  if (updatedTransaction.status === 'completed' && updatedTransaction.source === 'shopify' && merchant.shopifyShopDomain && merchant.shopifyAdminAccessToken && updatedTransaction.orderReference) {
    after(async () => {
      try {
        const result = await markShopifyOrderPaid({
          shopDomain: merchant.shopifyShopDomain!,
          accessToken: decryptSecret(merchant.shopifyAdminAccessToken!)!,
          orderId: updatedTransaction.orderReference!, // Contains numeric orderId
          mpesaReceipt: updatedTransaction.mpesaReceipt ?? 'N/A',
          amount: updatedTransaction.amount,
          currency: 'KES',
        });
        
        if (!result.success) {
          logger.error(`[Finalize Shopify] Failed to update Shopify order ${updatedTransaction.orderReference}: ${result.error}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`[Finalize Shopify] Uncaught error updating Shopify order ${updatedTransaction.orderReference}: ${msg}`);
      }
    });
  }
}
