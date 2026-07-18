import { describe, it, expect } from 'vitest';
import { verifyShopifyWebhook } from './shopify';
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
