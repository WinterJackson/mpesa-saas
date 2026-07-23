import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { GET } from './route';
import { auth } from '@clerk/nextjs/server';
import { getOrganizationContext, updateMerchantForOrganization } from '@/lib/repositories/organizations';
import { requireRole } from '@/lib/rbac';
import { exchangeCodeForToken, registerOrdersWebhook } from '@/lib/shopify';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/repositories/organizations', () => ({
  getOrganizationContext: vi.fn(),
  updateMerchantForOrganization: vi.fn(),
}));
vi.mock('@/lib/repositories/audit-log', () => ({ writeAuditLog: vi.fn() }));
vi.mock('@/lib/rbac', () => ({ requireRole: vi.fn() }));
vi.mock('@/lib/crypto', () => ({ encryptSecret: (s: string) => `enc(${s})` }));
vi.mock('@/lib/shopify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/shopify')>();
  return {
    ...actual,
    // Literal (not the SECRET const) — vi.mock factories are hoisted above const init.
    getShopifyAppConfig: vi.fn(() => ({ clientId: 'cid', clientSecret: 'app_client_secret', scopes: 'read_orders,write_orders' })),
    exchangeCodeForToken: vi.fn(),
    registerOrdersWebhook: vi.fn(),
  };
});

const SECRET = 'app_client_secret';
const SHOP = 'my-store.myshopify.com';

function signedUrl(params: Record<string, string>): string {
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const hmac = createHmac('sha256', SECRET).update(message).digest('hex');
  const sp = new URLSearchParams({ ...params, hmac });
  return `https://app.example.com/api/integrations/shopify/oauth/callback?${sp.toString()}`;
}

function makeRequest(url: string, cookie: string): Request {
  return new Request(url, { headers: { cookie, 'x-forwarded-host': 'app.example.com', 'x-forwarded-proto': 'https' } });
}

describe('GET shopify oauth callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'u-1', orgId: null } as never);
    vi.mocked(getOrganizationContext).mockResolvedValue({
      organization: { id: 'org-1' },
      membership: { role: 'owner' },
      merchant: { id: 'm-1' },
    } as never);
    vi.mocked(requireRole).mockResolvedValue({ allowed: true, membership: { role: 'owner' } as never });
    vi.mocked(exchangeCodeForToken).mockResolvedValue({ accessToken: 'shpat_token' });
    vi.mocked(registerOrdersWebhook).mockResolvedValue({ success: true });
  });

  it('rejects a bad HMAC and does not store anything', async () => {
    const parsed = new URL(signedUrl({ code: 'c', shop: SHOP, state: 'n1' }));
    parsed.searchParams.set('hmac', 'deadbeef');
    const res = await GET(makeRequest(parsed.toString(), `shopify_oauth_state=n1:${SHOP}`));
    expect(res.headers.get('location')).toContain('error=hmac_failed');
    expect(updateMerchantForOrganization).not.toHaveBeenCalled();
  });

  it('rejects a state/cookie mismatch (CSRF)', async () => {
    const url = signedUrl({ code: 'c', shop: SHOP, state: 'n1' });
    const res = await GET(makeRequest(url, `shopify_oauth_state=DIFFERENT:${SHOP}`));
    expect(res.headers.get('location')).toContain('error=state_mismatch');
    expect(updateMerchantForOrganization).not.toHaveBeenCalled();
  });

  it('exchanges the code, stores the encrypted token, and registers the webhook', async () => {
    const url = signedUrl({ code: 'c', shop: SHOP, state: 'n1' });
    const res = await GET(makeRequest(url, `shopify_oauth_state=n1:${SHOP}`));

    expect(exchangeCodeForToken).toHaveBeenCalledWith(expect.objectContaining({ shop: SHOP, code: 'c' }));
    expect(updateMerchantForOrganization).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ shopifyShopDomain: SHOP, shopifyAdminAccessToken: 'enc(shpat_token)' })
    );
    expect(registerOrdersWebhook).toHaveBeenCalled();
    expect(res.headers.get('location')).toContain(`connected=${encodeURIComponent(SHOP)}`);
  });

  it('surfaces a token-exchange failure without storing', async () => {
    vi.mocked(exchangeCodeForToken).mockResolvedValueOnce({ error: 'bad' });
    const url = signedUrl({ code: 'c', shop: SHOP, state: 'n1' });
    const res = await GET(makeRequest(url, `shopify_oauth_state=n1:${SHOP}`));
    expect(res.headers.get('location')).toContain('error=token_exchange_failed');
    expect(updateMerchantForOrganization).not.toHaveBeenCalled();
  });
});
