import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mutable mock env — getPlatformBillingConfig reads properties at call time.
vi.mock('@/lib/env', () => ({ env: {} as Record<string, string | undefined> }));
vi.mock('@/lib/db', () => ({ prisma: { darajaToken: { findUnique: vi.fn(), upsert: vi.fn() } } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { env } from '@/lib/env';
import { getPlatformBillingConfig, isPlatformBillingConfigured } from './platform-mpesa';

const e = env as unknown as Record<string, string | undefined>;

describe('getPlatformBillingConfig', () => {
  beforeEach(() => {
    for (const k of Object.keys(e)) delete e[k];
  });

  it('falls back to the pooled sandbox credentials when no dedicated Paybill is set', () => {
    e.MPESA_CONSUMER_KEY = 'ck';
    e.MPESA_CONSUMER_SECRET = 'cs';
    e.MPESA_SHORTCODE = '174379';
    e.MPESA_PASSKEY = 'pk';
    e.MPESA_CALLBACK_URL = 'https://app.example.com/api/mpesa/callback';

    const config = getPlatformBillingConfig();
    expect(config).not.toBeNull();
    expect(config!.isSandboxFallback).toBe(true);
    expect(config!.environment).toBe('sandbox');
    expect(config!.shortcode).toBe('174379');
    // Derives the billing callback from the merchant callback's origin.
    expect(config!.callbackUrl).toBe('https://app.example.com/api/mpesa/billing/callback');
    expect(isPlatformBillingConfigured()).toBe(true);
  });

  it('prefers a dedicated Paybill and marks it non-sandbox', () => {
    e.MPESA_CONSUMER_KEY = 'ck';
    e.MPESA_CONSUMER_SECRET = 'cs';
    e.MPESA_SHORTCODE = '174379';
    e.MPESA_PASSKEY = 'pk';
    e.MPESA_CALLBACK_URL = 'https://app.example.com/api/mpesa/callback';
    e.PLATFORM_BILLING_CONSUMER_KEY = 'pck';
    e.PLATFORM_BILLING_CONSUMER_SECRET = 'pcs';
    e.PLATFORM_BILLING_SHORTCODE = '555001';
    e.PLATFORM_BILLING_PASSKEY = 'ppk';
    e.PLATFORM_BILLING_ENV = 'live';

    const config = getPlatformBillingConfig();
    expect(config!.isSandboxFallback).toBe(false);
    expect(config!.environment).toBe('live');
    expect(config!.shortcode).toBe('555001');
    expect(config!.consumerKey).toBe('pck');
  });

  it('returns null (unconfigured) when neither Paybill nor sandbox credentials exist', () => {
    expect(getPlatformBillingConfig()).toBeNull();
    expect(isPlatformBillingConfigured()).toBe(false);
  });
});
