import { after } from 'next/server';
import { prisma } from '@/lib/db';
import { deliverWebhook } from '@/lib/webhook';
import { markShopifyOrderPaid } from '@/lib/shopify';
import { decryptSecret } from '@/lib/crypto';
import type { Transaction, Merchant } from '@prisma/client';
import { logger } from '@/lib/logger';

export function finalizeTransactionAsync(
  updatedTransaction: Transaction,
  merchant: Merchant
) {
  // ── 1. Outbound Webhook (Fire-and-Forget) ─────────────────────────────────
  if (merchant.webhookUrl) {
    const webhookPayload = {
      event: `payment.${updatedTransaction.status}`,
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
        const result = await deliverWebhook(merchant.webhookUrl!, webhookPayload, secret);
        
        await prisma.webhookDelivery.create({
          data: {
            transactionId: updatedTransaction.id,
            url: merchant.webhookUrl!,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            payload: webhookPayload as any,
            statusCode: result.statusCode ?? null,
            success: result.delivered,
            attempt: result.attempts,
          }
        });

        if (!result.delivered) {
          logger.warn(`[Finalize Webhook] Delivery failed to ${merchant.webhookUrl} (HTTP ${result.statusCode})`);
        }
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
          mpesaReceipt: updatedTransaction.mpesaReceipt ?? 'N/A'
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
