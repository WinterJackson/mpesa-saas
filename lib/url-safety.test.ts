import { describe, it, expect } from 'vitest';
import { isBlockedWebhookHostname } from './url-safety';

describe('isBlockedWebhookHostname', () => {
  it.each([
    'localhost',
    '127.0.0.1',
    '127.1.2.3',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '0.0.0.0',
    '::1',
    '[::1]',
    '[fe80::1]',
  ])('blocks %s', (hostname) => {
    expect(isBlockedWebhookHostname(hostname)).toBe(true);
  });

  it.each([
    'merchant.example.com',
    'api.mystore.co.ke',
    'hooks.stripe.com',
    '203.0.113.5', // public TEST-NET-3 address, not a private range
    '172.15.0.1', // just outside the 172.16.0.0/12 range
    '172.32.0.1', // just outside the 172.16.0.0/12 range
  ])('allows %s', (hostname) => {
    expect(isBlockedWebhookHostname(hostname)).toBe(false);
  });
});
