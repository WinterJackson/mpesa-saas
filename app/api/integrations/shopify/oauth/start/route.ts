import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { getShopifyAppConfig, isValidShopDomain, buildAuthorizeUrl } from '@/lib/shopify';
import { getAppBaseUrl } from '@/lib/app-url';
import { logger } from '@/lib/logger';

const STATE_COOKIE = 'shopify_oauth_state';

/**
 * Begins the one-click Shopify install. Requires an authenticated merchant
 * (owner/admin/developer), a configured platform app, and a valid *.myshopify.com
 * shop. Sets a short-lived signed-state cookie (CSRF) and redirects the browser
 * to Shopify's OAuth grant screen. The callback finishes the exchange.
 */
export async function GET(request: Request) {
  try {
    const config = getShopifyAppConfig();
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Shopify one-click connect is not configured on this platform yet.' },
        { status: 503 }
      );
    }

    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const context = await getOrganizationContext(userId, orgId);
    if (!context || !context.merchant) {
      return NextResponse.json({ success: false, error: 'Merchant not found' }, { status: 404 });
    }

    const rbac = await requireRole(context.organization.id, userId, ['owner', 'admin', 'developer']);
    if (!rbac.allowed) {
      return NextResponse.json({ success: false, error: rbac.error }, { status: rbac.status });
    }

    const shop = new URL(request.url).searchParams.get('shop')?.trim().toLowerCase() ?? '';
    if (!isValidShopDomain(shop)) {
      return NextResponse.json(
        { success: false, error: 'Enter a valid Shopify store domain (your-store.myshopify.com).' },
        { status: 400 }
      );
    }

    const nonce = randomBytes(16).toString('hex');
    const redirectUri = `${getAppBaseUrl(request)}/api/integrations/shopify/oauth/callback`;
    const authorizeUrl = buildAuthorizeUrl({
      shop,
      clientId: config.clientId,
      scopes: config.scopes,
      redirectUri,
      state: nonce,
    });

    const response = NextResponse.redirect(authorizeUrl);
    // Bind the OAuth attempt to this browser + shop for the callback's CSRF check.
    response.cookies.set(STATE_COOKIE, `${nonce}:${shop}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    return response;
  } catch (error: unknown) {
    logger.error('[Shopify OAuth Start Error]:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
