import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getDecryptedCredentials, isLiveCredentialConfigured, type DarajaCredentialSet } from '@/lib/repositories/daraja-credentials';

export const DARAJA_BASE_URLS = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  live: 'https://api.safaricom.co.ke',
} as const;

// Safaricom token lifespan is 3599 seconds (~1 hour). We cache for 50 mins to be safe.
const CACHE_TTL_MS = 50 * 60 * 1000;

/**
 * Whether the given organization has configured its own live Daraja
 * credentials (Model B — live credentials are always the organization's own,
 * never pooled/platform-wide).
 */
export async function isLiveModeConfigured(organizationId: string): Promise<boolean> {
  return isLiveCredentialConfigured(organizationId);
}

async function getDarajaCredentials(
  organizationId: string,
  environment: 'sandbox' | 'live'
): Promise<DarajaCredentialSet> {
  const credentials = await getDecryptedCredentials(organizationId, environment);

  if (!credentials) {
    if (environment === 'live') {
      throw new Error('Live M-Pesa credentials are not configured for this organization.');
    }
    throw new Error('Sandbox M-Pesa credentials are not configured for this organization.');
  }

  return credentials;
}

// ─── Token Management ────────────────────────────────────────────────────────

/**
 * Retrieves a valid Daraja OAuth access token for the given organization.
 * Uses a DB-backed per-organization cache with a 2-minute expiry buffer.
 * If the cached token is still valid (expiresAt > now + 2min), returns it.
 * Otherwise, fetches a new token from Safaricom and upserts the cache row.
 */
export async function getAccessToken(organizationId: string, environment: 'sandbox' | 'live'): Promise<string> {
  const TOKEN_ID = `${organizationId}_${environment}`;

  try {
    const cached = await prisma.darajaToken.findUnique({
      where: { id: TOKEN_ID },
    });

    // Return cached token if it's still valid with a 2-minute safety buffer
    if (cached && cached.expiresAt > new Date(Date.now() + 2 * 60 * 1000)) {
      return cached.accessToken;
    }
  } catch (dbError) {
    // If the DB read fails (e.g. table doesn't exist yet), we fall through to fetch a new token
    logger.warn('DarajaToken cache read failed, fetching fresh token:', dbError);
  }

  // Token missing, expired, or cache read failed — fetch a new one
  const credentials = await getDarajaCredentials(organizationId, environment);
  const base64Auth = Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString('base64');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${DARAJA_BASE_URLS[environment]}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET', // Daraja OAuth endpoint uses GET
      headers: {
        Authorization: `Basic ${base64Auth}`,
      },
      signal: controller.signal as AbortSignal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body');
      logger.error(`Daraja OAuth Error [${response.status}]:`, errorText);
      throw new Error(`Daraja authentication failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      logger.error('Daraja OAuth returned no access_token:', data);
      throw new Error('Daraja returned an invalid token response');
    }

    const accessToken: string = data.access_token;

    // Cache the new token in the database
    await prisma.darajaToken.upsert({
      where: { id: TOKEN_ID },
      update: {
        accessToken,
        expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      },
      create: {
        id: TOKEN_ID,
        accessToken,
        expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      },
    });

    return accessToken;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Daraja token generation failed:', message);

    // Sanitize error — never leak credentials or internal details to callers
    if (message.includes('AbortError') || (error instanceof DOMException && error.name === 'AbortError')) {
      throw new Error('Payment gateway timed out during authentication. Please try again.');
    }
    throw new Error('Could not authenticate with the payment gateway.');
  }
}

// ─── Timestamp & Password Generation ─────────────────────────────────────────

/**
 * Generates a Nairobi-timezone timestamp in YYYYMMDDHHmmss format.
 * CRITICAL: Uses server-side time only — never trust client-provided timestamps.
 */
function generateTimestamp(): string {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';

  // Format: YYYYMMDDHHmmss
  return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`;
}

function generatePassword(timestamp: string, credentials: DarajaCredentialSet): string {
  return Buffer.from(`${credentials.shortcode}${credentials.passkey}${timestamp}`).toString('base64');
}

// ─── STK Push ────────────────────────────────────────────────────────────────

export interface STKPushParams {
  /** The organization initiating this push — resolves its own Daraja credentials (Model B) */
  organizationId: string;
  /** Phone number in 2547XXXXXXXX format (already validated via lib/validation.ts) */
  phone: string;
  /** Transaction amount in KES (integer > 0, already validated) */
  amount: number;
  /** Account reference visible to the customer (max 12 chars) */
  accountReference?: string;
  /** Transaction description (max 13 chars) */
  transactionDesc?: string;
  /** The target environment for the transaction */
  environment: 'sandbox' | 'live';
}

export interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

/**
 * Initiates an M-Pesa Express (Lipa Na M-Pesa Online) STK Push.
 * This triggers a payment prompt on the customer's phone.
 *
 * SECURITY:
 * - Timestamp/password generated server-side only
 * - Credentials resolved per-organization (Model B) — never a global constant
 * - 10-second timeout on the external HTTP call
 * - Errors are logged server-side but sanitized before returning to callers
 */
export async function initiateSTKPush({
  organizationId,
  phone,
  amount,
  accountReference = 'PaySwift',
  transactionDesc = 'Payment',
  environment,
}: STKPushParams): Promise<STKPushResponse> {
  const credentials = await getDarajaCredentials(organizationId, environment);
  const accessToken = await getAccessToken(organizationId, environment);
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp, credentials);

  const payload = {
    BusinessShortCode: credentials.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phone,
    PartyB: credentials.shortcode,
    PhoneNumber: phone,
    CallBackURL: credentials.callbackUrl,
    AccountReference: accountReference.substring(0, 12),
    TransactionDesc: transactionDesc.substring(0, 13),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${DARAJA_BASE_URLS[environment]}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal as AbortSignal,
    });

    clearTimeout(timeoutId);

    const responseData = await response.json();

    if (!response.ok) {
      logger.error(`Daraja STK Push Error [${response.status}]:`, JSON.stringify(responseData));
      throw new Error(`Payment gateway rejected request: ${response.status}`);
    }

    return responseData as STKPushResponse;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Daraja STK Push failed:', message);

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Payment gateway timed out. Please try again.');
    }
    // Re-throw if it's already our sanitized error
    if (error instanceof Error && error.message.startsWith('Payment gateway')) {
      throw error;
    }
    throw new Error('Failed to initiate payment prompt.');
  }
}

// ─── STK Push Status Query ───────────────────────────────────────────────────

export interface STKQueryResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
}

/**
 * Queries the status of a previously initiated STK Push transaction.
 * Used as a fallback when the callback hasn't been received yet.
 */
export async function querySTKPushStatus(
  checkoutRequestId: string,
  organizationId: string,
  environment: 'sandbox' | 'live'
): Promise<STKQueryResponse> {
  const credentials = await getDarajaCredentials(organizationId, environment);
  const accessToken = await getAccessToken(organizationId, environment);
  const timestamp = generateTimestamp();
  const password = generatePassword(timestamp, credentials);

  const payload = {
    BusinessShortCode: credentials.shortcode,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${DARAJA_BASE_URLS[environment]}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal as AbortSignal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      logger.error(`Daraja STK Query Error [${response.status}]:`, JSON.stringify(data));
      throw new Error(`Failed to query transaction status: ${response.status}`);
    }

    return data as STKQueryResponse;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Daraja status query failed:', message);

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Transaction status query timed out. Please try again.');
    }
    if (error instanceof Error && error.message.startsWith('Failed to query')) {
      throw error;
    }
    throw new Error('Failed to query transaction status.');
  }
}
