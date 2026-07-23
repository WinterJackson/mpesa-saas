import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  verifyShopifyWebhook,
  verifyOAuthHmac,
  isValidShopDomain,
  buildAuthorizeUrl,
  getShopifyAppConfig,
  registerOrdersWebhook,
  markShopifyOrderPaid,
} from './shopify';
import { createHmac } from 'node:crypto';

describe('verifyShopifyWebhook', () => {
  const secret = 'test_secret';
  const rawBody = JSON.stringify({ test: 'payload' });

  it('should validate with a correct HMAC', () => {
    const hmacHeader = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    expect(verifyShopifyWebhook(rawBody, hmacHeader, secret)).toBe(true);
  });

  it('should fail with a tampered body', () => {
    const hmacHeader = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    const tamperedBody = JSON.stringify({ test: 'tampered' });
    expect(verifyShopifyWebhook(tamperedBody, hmacHeader, secret)).toBe(false);
  });

  it('should fail with a wrong secret', () => {
    const wrongSecret = 'wrong_secret';
    const hmacHeader = createHmac('sha256', wrongSecret).update(rawBody, 'utf8').digest('base64');
    expect(verifyShopifyWebhook(rawBody, hmacHeader, secret)).toBe(false);
  });

  it('should fail with an invalid base64 string', () => {
    expect(verifyShopifyWebhook(rawBody, 'invalid-base64', secret)).toBe(false);
  });
});

describe('isValidShopDomain', () => {
  it('accepts a well-formed myshopify domain', () => {
    expect(isValidShopDomain('my-store.myshopify.com')).toBe(true);
  });
  it('rejects schemes, paths, and non-myshopify hosts', () => {
    expect(isValidShopDomain('https://my-store.myshopify.com')).toBe(false);
    expect(isValidShopDomain('my-store.myshopify.com/admin')).toBe(false);
    expect(isValidShopDomain('evil.com')).toBe(false);
    expect(isValidShopDomain('')).toBe(false);
  });
});

describe('buildAuthorizeUrl', () => {
  it('builds the Shopify grant URL with all params', () => {
    const url = buildAuthorizeUrl({
      shop: 'my-store.myshopify.com',
      clientId: 'cid',
      scopes: 'read_orders,write_orders',
      redirectUri: 'https://app/api/integrations/shopify/oauth/callback',
      state: 'nonce123',
    });
    expect(url).toContain('https://my-store.myshopify.com/admin/oauth/authorize?');
    expect(url).toContain('client_id=cid');
    expect(url).toContain('scope=read_orders%2Cwrite_orders');
    expect(url).toContain('state=nonce123');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fapp');
  });
});

describe('verifyOAuthHmac', () => {
  const secret = 'app_client_secret';

  function signed(params: Record<string, string>): URLSearchParams {
    const sp = new URLSearchParams(params);
    const message = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    const hmac = createHmac('sha256', secret).update(message).digest('hex');
    sp.set('hmac', hmac);
    return sp;
  }

  it('verifies a correctly-signed query', () => {
    const sp = signed({ code: 'abc', shop: 'my-store.myshopify.com', state: 'n1' });
    expect(verifyOAuthHmac(sp, secret)).toBe(true);
  });

  it('rejects a tampered query', () => {
    const sp = signed({ code: 'abc', shop: 'my-store.myshopify.com', state: 'n1' });
    sp.set('code', 'tampered');
    expect(verifyOAuthHmac(sp, secret)).toBe(false);
  });

  it('rejects when hmac is missing', () => {
    const sp = new URLSearchParams({ code: 'abc' });
    expect(verifyOAuthHmac(sp, secret)).toBe(false);
  });
});

describe('getShopifyAppConfig', () => {
  const original = process.env;
  beforeEach(() => { process.env = { ...original }; });
  afterEach(() => { process.env = original; });

  it('returns null until both client id and secret are set', () => {
    delete process.env.SHOPIFY_CLIENT_ID;
    delete process.env.SHOPIFY_CLIENT_SECRET;
    expect(getShopifyAppConfig()).toBeNull();
  });

  it('returns config with default scopes when configured', () => {
    process.env.SHOPIFY_CLIENT_ID = 'cid';
    process.env.SHOPIFY_CLIENT_SECRET = 'secret';
    delete process.env.SHOPIFY_APP_SCOPES;
    expect(getShopifyAppConfig()).toEqual({
      clientId: 'cid',
      clientSecret: 'secret',
      scopes: 'read_orders,write_orders',
    });
  });
});

describe('registerOrdersWebhook', () => {
  afterEach(() => vi.restoreAllMocks());

  it('treats a 422 "already been taken" as success (idempotent)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('{"errors":{"address":["for this topic has already been taken"]}}', { status: 422 })
    );
    const result = await registerOrdersWebhook({ shopDomain: 's.myshopify.com', accessToken: 't', callbackUrl: 'https://app/wh' });
    expect(result.success).toBe(true);
  });

  it('reports a genuine failure', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('nope', { status: 401 }));
    const result = await registerOrdersWebhook({ shopDomain: 's.myshopify.com', accessToken: 't', callbackUrl: 'https://app/wh' });
    expect(result.success).toBe(false);
  });
});

describe('markShopifyOrderPaid', () => {
  afterEach(() => vi.restoreAllMocks());

  it('records a real sale transaction when the transactions endpoint accepts it', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 201 }));
    const result = await markShopifyOrderPaid({
      shopDomain: 's.myshopify.com',
      accessToken: 't',
      orderId: 123,
      mpesaReceipt: 'ABC',
      amount: 2500,
      currency: 'KES',
    });
    expect(result.success).toBe(true);
    expect(result.method).toBe('transaction');
    expect(fetchMock.mock.calls[0][0]).toContain('/orders/123/transactions.json');
  });

  it('falls back to note/tag when the transaction path is rejected', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('rejected', { status: 422 })) // transactions.json
      .mockResolvedValueOnce(new Response('{}', { status: 200 })); // orders/{id}.json
    const result = await markShopifyOrderPaid({
      shopDomain: 's.myshopify.com',
      accessToken: 't',
      orderId: 123,
      mpesaReceipt: 'ABC',
    });
    expect(result.success).toBe(true);
    expect(result.method).toBe('note');
    expect(fetchMock.mock.calls[1][0]).toContain('/orders/123.json');
  });
});
