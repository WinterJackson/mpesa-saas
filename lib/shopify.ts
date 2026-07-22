import { createHmac, timingSafeEqual } from 'node:crypto';
import { logger } from '@/lib/logger';

const SHOPIFY_API_VERSION = '2026-07';

export function verifyShopifyWebhook(rawBody: string, hmacHeader: string, secret: string): boolean {
  try {
    const generatedHash = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    const generatedBuffer = Buffer.from(generatedHash, 'utf8');
    const providedBuffer = Buffer.from(hmacHeader, 'utf8');
    
    if (generatedBuffer.length !== providedBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(generatedBuffer, providedBuffer);
  } catch {
    return false;
  }
}

export async function markShopifyOrderPaid(params: {
  shopDomain: string;
  accessToken: string;
  orderId: string | number;
  mpesaReceipt: string;
}): Promise<{ success: boolean; error?: string }> {
  const { shopDomain, accessToken, orderId, mpesaReceipt } = params;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  
  try {
    const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders/${orderId}.json`;
    
    // Note: We use the order note and tags to mark payment status. 
    // Creating formal transactions via orders/{id}/transactions.json requires stricter 
    // validation and often Shopify Payments App approval, which is out of scope for this MVP.
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({
        order: {
          id: orderId,
          note: `Paid via M-Pesa — Receipt: ${mpesaReceipt}`,
          tags: 'mpesa-paid',
        }
      }),
      signal: controller.signal as AbortSignal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body');
      logger.error(`[Shopify] Failed to mark order ${orderId} as paid: HTTP ${response.status} - ${errorText}`);
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    logger.info(`[Shopify] Successfully marked order ${orderId} as paid`);
    return { success: true };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof DOMException && error.name === 'AbortError') {
      logger.error(`[Shopify] Timeout marking order ${orderId} as paid`);
      return { success: false, error: 'Timeout' };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[Shopify] Error marking order ${orderId} as paid: ${message}`);
    return { success: false, error: message };
  }
}

export async function verifyShopifyCredentials(shopDomain: string, accessToken: string): Promise<{ valid: boolean; shopName?: string }> {
  try {
    const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      }
    });
    
    if (!response.ok) {
      return { valid: false };
    }
    
    const data = await response.json();
    return { valid: true, shopName: data.shop?.name };
  } catch {
    return { valid: false };
  }
}
