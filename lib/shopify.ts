import { createHmac, timingSafeEqual } from 'node:crypto';
import { logger } from '@/lib/logger';

const SHOPIFY_API_VERSION = '2026-07';
const DEFAULT_APP_SCOPES = 'read_orders,write_orders';

export interface ShopifyAppConfig {
  clientId: string;
  clientSecret: string;
  scopes: string;
}

/**
 * The platform's ONE Shopify public-app credentials (the "one app, many stores"
 * SaaS model). Returns null until SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET are
 * configured, which is how the whole OAuth flow stays cleanly dormant (and the
 * UI falls back to the manual token card) until the operator sets them up. Read
 * from process.env directly so a missing var never trips the strict env
 * validator for unrelated features.
 */
export function getShopifyAppConfig(): ShopifyAppConfig | null {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, scopes: process.env.SHOPIFY_APP_SCOPES || DEFAULT_APP_SCOPES };
}

/** A well-formed `*.myshopify.com` store domain (no scheme/path), used to build
 * the authorize URL and reject open-redirect / SSRF attempts on the shop param. */
export function isValidShopDomain(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

/** Shopify's OAuth grant URL the merchant is redirected to, to approve install. */
export function buildAuthorizeUrl(params: {
  shop: string;
  clientId: string;
  scopes: string;
  redirectUri: string;
  state: string;
}): string {
  const { shop, clientId, scopes, redirectUri, state } = params;
  const query = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${query.toString()}`;
}

/**
 * Verifies the HMAC signature Shopify appends to the OAuth callback query. All
 * params except `hmac` (and the legacy `signature`) are sorted and joined, then
 * HMAC-SHA256'd with the app's client secret and compared in constant time.
 */
export function verifyOAuthHmac(searchParams: URLSearchParams, clientSecret: string): boolean {
  const hmac = searchParams.get('hmac');
  if (!hmac) return false;

  const pairs: string[] = [];
  for (const [key, value] of searchParams) {
    if (key === 'hmac' || key === 'signature') continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const message = pairs.join('&');

  const digest = createHmac('sha256', clientSecret).update(message).digest('hex');
  try {
    const a = Buffer.from(digest, 'utf8');
    const b = Buffer.from(hmac, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Exchanges an approved OAuth `code` for a permanent Admin API access token. */
export async function exchangeCodeForToken(params: {
  shop: string;
  clientId: string;
  clientSecret: string;
  code: string;
}): Promise<{ accessToken: string } | { error: string }> {
  const { shop, clientId, clientSecret, code } = params;
  try {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    if (!response.ok) {
      return { error: `Token exchange failed: HTTP ${response.status}` };
    }
    const data = await response.json();
    if (!data.access_token) return { error: 'Token exchange returned no access_token' };
    return { accessToken: data.access_token as string };
  } catch (error: unknown) {
    return { error: error instanceof Error ? error.message : 'Token exchange error' };
  }
}

/**
 * Registers the orders/create webhook so the merchant never has to. Idempotent:
 * Shopify returns 422 ("address for this topic has already been taken") when the
 * subscription already exists — treated as success.
 */
export async function registerOrdersWebhook(params: {
  shopDomain: string;
  accessToken: string;
  callbackUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const { shopDomain, accessToken, callbackUrl } = params;
  try {
    const response = await fetch(
      `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
        body: JSON.stringify({
          webhook: { topic: 'orders/create', address: callbackUrl, format: 'json' },
        }),
      }
    );

    if (response.ok) return { success: true };

    // 422 with a "has already been taken" error means the webhook already exists.
    if (response.status === 422) {
      const body = await response.text().catch(() => '');
      if (body.includes('already been taken') || body.includes('taken')) return { success: true };
      return { success: false, error: `HTTP 422: ${body.slice(0, 200)}` };
    }
    return { success: false, error: `HTTP ${response.status}` };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Webhook registration error' };
  }
}

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

/**
 * Marks a Shopify order paid after M-Pesa confirms. Primary path: create a real
 * order transaction (kind: 'sale', status: 'success', gateway 'M-Pesa') so the
 * order's financial status actually moves to paid — the correct behaviour for a
 * store using M-Pesa as a manual/offsite payment method. If that is rejected
 * (e.g. the store's payment config won't accept an external sale transaction),
 * it falls back to the previous note + `mpesa-paid` tag so the receipt is never
 * lost. Idempotent-friendly: the tag fallback is safe to re-apply.
 */
export async function markShopifyOrderPaid(params: {
  shopDomain: string;
  accessToken: string;
  orderId: string | number;
  mpesaReceipt: string;
  amount?: number;
  currency?: string;
}): Promise<{ success: boolean; method?: 'transaction' | 'note'; error?: string }> {
  const { shopDomain, accessToken, orderId, mpesaReceipt, amount, currency } = params;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': accessToken,
  };

  try {
    // ── Primary: create a real 'sale' transaction on the order. ──────────────
    const txUrl = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders/${orderId}/transactions.json`;
    const txBody: Record<string, unknown> = {
      transaction: {
        kind: 'sale',
        status: 'success',
        gateway: 'M-Pesa',
        source: 'external',
        authorization: mpesaReceipt,
        ...(amount != null ? { amount: String(amount) } : {}),
        ...(currency ? { currency } : {}),
      },
    };

    const txResponse = await fetch(txUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(txBody),
      signal: controller.signal as AbortSignal,
    });

    if (txResponse.ok) {
      clearTimeout(timeoutId);
      logger.info(`[Shopify] Recorded M-Pesa sale transaction on order ${orderId}`);
      return { success: true, method: 'transaction' };
    }

    // ── Fallback: note + tag (never lose the receipt). ───────────────────────
    logger.warn(
      `[Shopify] Sale-transaction path rejected for order ${orderId} (HTTP ${txResponse.status}); falling back to note/tag.`
    );

    const orderUrl = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/orders/${orderId}.json`;
    const noteResponse = await fetch(orderUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        order: { id: orderId, note: `Paid via M-Pesa — Receipt: ${mpesaReceipt}`, tags: 'mpesa-paid' },
      }),
      signal: controller.signal as AbortSignal,
    });

    clearTimeout(timeoutId);

    if (!noteResponse.ok) {
      const errorText = await noteResponse.text().catch(() => 'No response body');
      logger.error(`[Shopify] Failed to mark order ${orderId} as paid: HTTP ${noteResponse.status} - ${errorText}`);
      return { success: false, error: `HTTP ${noteResponse.status}` };
    }

    logger.info(`[Shopify] Marked order ${orderId} paid via note/tag fallback`);
    return { success: true, method: 'note' };
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
