import { DARAJA_BASE_URLS, getAccessToken } from '@/lib/daraja';
import { getDecryptedCredentials, getDecryptedInitiator } from '@/lib/repositories/daraja-credentials';
import { generateSecurityCredential } from '@/lib/daraja-security-credential';
import { b2cResultUrl, b2cTimeoutUrl } from '@/lib/daraja-urls';
import { withApiSpan } from '@/lib/tracing';
import { logger } from '@/lib/logger';

// ─── B2C (Business → Customer) — payouts & refunds ─────────────────────────
//
// Materially different auth from STK: instead of just an OAuth token, B2C needs
// the operator's InitiatorName + a SecurityCredential (the initiator password
// RSA-encrypted with Safaricom's public cert — see lib/daraja-security-credential.ts).
// Credentials + initiator are resolved per-organization (Model B).

export type B2CCommandID = 'BusinessPayment' | 'SalaryPayment' | 'PromotionPayment';

export interface B2CParams {
  organizationId: string;
  environment: 'sandbox' | 'live';
  amount: number;
  /** Recipient MSISDN, 2547XXXXXXXX (validated upstream). */
  phone: string;
  commandId?: B2CCommandID;
  remarks?: string;
  occasion?: string;
}

export interface B2CResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

/**
 * Initiates a B2C payment request. Resolves per-org credentials + initiator,
 * builds the RSA SecurityCredential, and POSTs to Daraja. Terminal status is
 * NOT known here — it arrives asynchronously at the result callback, correlated
 * by OriginatorConversationID (mirrors STK's CheckoutRequestID pattern).
 */
export async function initiateB2C(params: B2CParams): Promise<B2CResponse> {
  const { organizationId, environment, amount, phone, commandId = 'BusinessPayment', remarks, occasion } = params;

  const credentials = await getDecryptedCredentials(organizationId, environment);
  if (!credentials) {
    throw new Error(`${environment === 'live' ? 'Live' : 'Sandbox'} M-Pesa credentials are not configured for this organization.`);
  }

  const initiator = await getDecryptedInitiator(organizationId, environment);
  if (!initiator) {
    throw new Error(`B2C initiator credentials are not configured for this organization (${environment}). Add them under Payment Setup.`);
  }

  const securityCredential = generateSecurityCredential(initiator.password, environment);
  const accessToken = await getAccessToken(organizationId, environment);

  const payload = {
    InitiatorName: initiator.name,
    SecurityCredential: securityCredential,
    CommandID: commandId,
    Amount: amount,
    PartyA: credentials.shortcode,
    PartyB: phone,
    Remarks: (remarks ?? 'Payout').substring(0, 100),
    QueueTimeOutURL: b2cTimeoutUrl(),
    ResultURL: b2cResultUrl(),
    Occasion: (occasion ?? '').substring(0, 100),
  };

  return withApiSpan('daraja.b2c', 'http.client', organizationId, async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${DARAJA_BASE_URLS[environment]}/mpesa/b2c/v3/paymentrequest`, {
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
        logger.error(`Daraja B2C Error [${response.status}]:`, JSON.stringify(data));
        throw new Error(`Payment gateway rejected the payout request: ${response.status}`);
      }

      return data as B2CResponse;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Daraja B2C request failed:', message);

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Payment gateway timed out while sending the payout. Please try again.');
      }
      if (error instanceof Error && (message.startsWith('Payment gateway') || message.includes('not configured'))) {
        throw error;
      }
      throw new Error('Failed to send the payout.');
    }
  });
}
