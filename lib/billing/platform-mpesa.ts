import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { withApiSpan } from '@/lib/tracing';
import { DARAJA_BASE_URLS } from '@/lib/daraja';

/**
 * Platform subscription-billing collector (Stage D).
 *
 * WHY THIS IS SEPARATE from lib/daraja.ts's per-organization STK path (and NOT a
 * violation of the "one money-movement path" guardrails): those functions resolve
 * a MERCHANT tenant's own Daraja credentials (Model B) to collect money INTO that
 * merchant's shortcode. Here PaySwift is the collector — it charges merchants
 * their subscription fee INTO PaySwift's OWN Paybill. That is a distinct actor
 * (the platform, not a tenant) with its own credentials and its own callback, so
 * it deliberately does not thread an `organizationId` through the tenant path.
 *
 * Credentials are env-driven and swap without code changes: set PLATFORM_BILLING_*
 * to a real Paybill to go live; until then it FALLS BACK to the pooled sandbox
 * credentials (MPESA_*) so the whole subscription-billing + dunning flow is
 * demonstrable end-to-end in sandbox. No secret is ever logged.
 */

export interface PlatformBillingConfig {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
  environment: 'sandbox' | 'live';
  /** true when running on the sandbox fallback rather than a dedicated Paybill. */
  isSandboxFallback: boolean;
}

/**
 * Resolves the platform billing credentials, preferring a dedicated Paybill
 * (PLATFORM_BILLING_*) and falling back to the pooled sandbox account (MPESA_*).
 * Returns null only if even the sandbox callback URL can't be determined.
 */
export function getPlatformBillingConfig(): PlatformBillingConfig | null {
  const usingPaybill = Boolean(env.PLATFORM_BILLING_SHORTCODE && env.PLATFORM_BILLING_CONSUMER_KEY);

  const consumerKey = env.PLATFORM_BILLING_CONSUMER_KEY ?? env.MPESA_CONSUMER_KEY;
  const consumerSecret = env.PLATFORM_BILLING_CONSUMER_SECRET ?? env.MPESA_CONSUMER_SECRET;
  const shortcode = env.PLATFORM_BILLING_SHORTCODE ?? env.MPESA_SHORTCODE;
  const passkey = env.PLATFORM_BILLING_PASSKEY ?? env.MPESA_PASSKEY;
  const environment: 'sandbox' | 'live' = usingPaybill ? env.PLATFORM_BILLING_ENV ?? 'live' : 'sandbox';

  // Callback: explicit override, else derive from the merchant STK callback's
  // origin so we point at OUR billing callback route on the same host.
  let callbackUrl = env.PLATFORM_BILLING_CALLBACK_URL ?? null;
  if (!callbackUrl) {
    const base = env.MPESA_CALLBACK_BASE_URL ?? originOf(env.MPESA_CALLBACK_URL);
    if (base) callbackUrl = `${base.replace(/\/$/, '')}/api/mpesa/billing/callback`;
  }

  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) {
    return null;
  }

  return {
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    callbackUrl,
    environment,
    isSandboxFallback: !usingPaybill,
  };
}

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function isPlatformBillingConfigured(): boolean {
  return getPlatformBillingConfig() !== null;
}

// ─── Token cache (platform-scoped, distinct id from any merchant token) ──────
const CACHE_TTL_MS = 50 * 60 * 1000;

async function getPlatformAccessToken(config: PlatformBillingConfig): Promise<string> {
  const tokenId = `platform_billing_${config.environment}`;

  try {
    const cached = await prisma.darajaToken.findUnique({ where: { id: tokenId } });
    if (cached && cached.expiresAt > new Date(Date.now() + 2 * 60 * 1000)) {
      return cached.accessToken;
    }
  } catch (e) {
    logger.warn('[Billing] platform token cache read failed, fetching fresh:', e);
  }

  const basicAuth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(
      `${DARAJA_BASE_URLS[config.environment]}/oauth/v1/generate?grant_type=client_credentials`,
      { method: 'GET', headers: { Authorization: `Basic ${basicAuth}` }, signal: controller.signal as AbortSignal }
    );
    clearTimeout(timeoutId);
    if (!res.ok) {
      throw new Error(`Platform billing OAuth failed with status ${res.status}`);
    }
    const data = await res.json();
    if (!data.access_token) throw new Error('Platform billing OAuth returned no access_token');
    const accessToken: string = data.access_token;
    await prisma.darajaToken.upsert({
      where: { id: tokenId },
      update: { accessToken, expiresAt: new Date(Date.now() + CACHE_TTL_MS) },
      create: { id: tokenId, accessToken, expiresAt: new Date(Date.now() + CACHE_TTL_MS) },
    });
    return accessToken;
  } catch (error) {
    clearTimeout(timeoutId);
    logger.error('[Billing] platform token generation failed:', error instanceof Error ? error.message : 'unknown');
    throw new Error('Could not authenticate the platform billing collector.');
  }
}

// ─── Timestamp / password (same construction as the merchant STK path) ───────
function nairobiTimestamp(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`;
}

export interface BillingStkResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  customerMessage: string;
  isSandboxFallback: boolean;
}

/**
 * Sends an STK Push charging `phone` for `amount` KES into PaySwift's billing
 * shortcode. Returns the CheckoutRequestID to correlate the billing callback.
 * Throws on any gateway/config failure (callers treat that as a failed attempt).
 */
export async function initiateBillingStkPush(params: {
  phone: string;
  amount: number;
  accountReference: string;
  transactionDesc?: string;
}): Promise<BillingStkResult> {
  const config = getPlatformBillingConfig();
  if (!config) {
    throw new Error('Platform billing is not configured.');
  }

  const accessToken = await getPlatformAccessToken(config);
  const timestamp = nairobiTimestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString('base64');

  const payload = {
    BusinessShortCode: config.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: params.amount,
    PartyA: params.phone,
    PartyB: config.shortcode,
    PhoneNumber: params.phone,
    CallBackURL: config.callbackUrl,
    AccountReference: params.accountReference.substring(0, 12),
    TransactionDesc: (params.transactionDesc ?? 'Subscription').substring(0, 13),
  };

  return withApiSpan('billing.stk_push', 'http.client', 'platform', async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${DARAJA_BASE_URLS[config.environment]}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal as AbortSignal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok || !data.CheckoutRequestID) {
        logger.error(`[Billing] STK push rejected [${res.status}]:`, JSON.stringify(data));
        throw new Error(`Billing gateway rejected request: ${res.status}`);
      }
      return {
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID,
        customerMessage: data.CustomerMessage ?? '',
        isSandboxFallback: config.isSandboxFallback,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      logger.error('[Billing] STK push failed:', error instanceof Error ? error.message : 'unknown');
      throw new Error('Failed to initiate the subscription payment prompt.');
    }
  });
}
