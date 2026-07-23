import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext, updateMerchantForOrganization } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import {
  getShopifyAppConfig,
  isValidShopDomain,
  verifyOAuthHmac,
  exchangeCodeForToken,
  registerOrdersWebhook,
} from '@/lib/shopify';
import { encryptSecret } from '@/lib/crypto';
import { getAppBaseUrl } from '@/lib/app-url';
import { writeAuditLog } from '@/lib/repositories/audit-log';
import { logger } from '@/lib/logger';

const STATE_COOKIE = 'shopify_oauth_state';

function redirectToIntegrations(request: Request, params: Record<string, string>) {
  const url = new URL('/integrations', getAppBaseUrl(request));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const response = NextResponse.redirect(url);
  response.cookies.delete(STATE_COOKIE);
  return response;
}

/**
 * Finishes the one-click Shopify install: verifies the callback HMAC + the CSRF
 * state cookie, exchanges the code for a permanent Admin API token, stores it
 * (encrypted) on the merchant, and auto-registers the orders/create webhook.
 * User-facing outcomes are surfaced as query params on /integrations.
 */
export async function GET(request: Request) {
  try {
    const config = getShopifyAppConfig();
    if (!config) {
      return redirectToIntegrations(request, { error: 'shopify_not_configured' });
    }

    const params = new URL(request.url).searchParams;
    const shop = params.get('shop')?.trim().toLowerCase() ?? '';
    const code = params.get('code') ?? '';
    const state = params.get('state') ?? '';

    if (!isValidShopDomain(shop) || !code) {
      return redirectToIntegrations(request, { error: 'invalid_request' });
    }

    // 1. Verify Shopify's HMAC over the query (authenticity).
    if (!verifyOAuthHmac(params, config.clientSecret)) {
      logger.warn('[Shopify OAuth Callback] HMAC verification failed');
      return redirectToIntegrations(request, { error: 'hmac_failed' });
    }

    // 2. Verify the CSRF state cookie matches the returned state + shop.
    const cookie = request.headers.get('cookie') ?? '';
    const cookieMatch = cookie.match(new RegExp(`${STATE_COOKIE}=([^;]+)`));
    const cookieVal = cookieMatch ? decodeURIComponent(cookieMatch[1]) : '';
    const [expectedNonce, expectedShop] = cookieVal.split(':');
    if (!expectedNonce || expectedNonce !== state || expectedShop !== shop) {
      logger.warn('[Shopify OAuth Callback] State/CSRF mismatch');
      return redirectToIntegrations(request, { error: 'state_mismatch' });
    }

    // 3. The install is initiated from the merchant's own browser session.
    const { userId, orgId } = await auth();
    if (!userId) return redirectToIntegrations(request, { error: 'not_signed_in' });

    const context = await getOrganizationContext(userId, orgId);
    if (!context || !context.merchant) {
      return redirectToIntegrations(request, { error: 'merchant_not_found' });
    }

    const rbac = await requireRole(context.organization.id, userId, ['owner', 'admin', 'developer']);
    if (!rbac.allowed) return redirectToIntegrations(request, { error: 'forbidden' });

    // 4. Exchange the code for a permanent access token.
    const exchange = await exchangeCodeForToken({
      shop,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
    });
    if ('error' in exchange) {
      logger.error('[Shopify OAuth Callback] Token exchange failed:', exchange.error);
      return redirectToIntegrations(request, { error: 'token_exchange_failed' });
    }

    // 5. Persist the connection (token encrypted at rest).
    await updateMerchantForOrganization(context.organization.id, {
      shopifyShopDomain: shop,
      shopifyAdminAccessToken: encryptSecret(exchange.accessToken),
    });

    // 6. Auto-register the orders/create webhook (best-effort — the connection
    // is already usable; a failed registration is surfaced but not fatal).
    const webhookResult = await registerOrdersWebhook({
      shopDomain: shop,
      accessToken: exchange.accessToken,
      callbackUrl: `${getAppBaseUrl(request)}/api/integrations/shopify/webhook`,
    });
    if (!webhookResult.success) {
      logger.warn(`[Shopify OAuth Callback] Webhook auto-registration failed: ${webhookResult.error}`);
    }

    await writeAuditLog({
      organizationId: context.organization.id,
      actorId: userId,
      action: 'shopify.connected',
      metadata: { shop, webhookRegistered: webhookResult.success },
    });

    return redirectToIntegrations(request, {
      connected: shop,
      ...(webhookResult.success ? {} : { warning: 'webhook_registration_failed' }),
    });
  } catch (error: unknown) {
    logger.error('[Shopify OAuth Callback Error]:', error instanceof Error ? error.message : 'Unknown error');
    return redirectToIntegrations(request, { error: 'internal_error' });
  }
}
