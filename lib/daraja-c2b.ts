import { DARAJA_BASE_URLS, getAccessToken } from '@/lib/daraja';
import { getDecryptedCredentials } from '@/lib/repositories/daraja-credentials';
import { c2bConfirmationUrl, c2bValidationUrl } from '@/lib/daraja-urls';
import { logger } from '@/lib/logger';

// ─── C2B (Customer → Business) — direct Paybill/Till payments ──────────────
// The customer initiates from their phone (not an STK prompt). We register our
// Confirmation/Validation URLs against the org's shortcode; Safaricom then POSTs
// to those routes when a customer pays.

export interface RegisterC2BResponse {
  OriginatorCoversationID?: string; // (sic — Daraja's spelling)
  ConversationID?: string;
  ResponseDescription: string;
}

/**
 * Registers PaySwift's Confirmation/Validation URLs for the org's shortcode.
 * ResponseType 'Completed' means a payment still completes if our Validation URL
 * is unreachable (safer default than 'Cancelled').
 */
export async function registerC2BUrls(params: {
  organizationId: string;
  environment: 'sandbox' | 'live';
}): Promise<RegisterC2BResponse> {
  const { organizationId, environment } = params;

  const credentials = await getDecryptedCredentials(organizationId, environment);
  if (!credentials) {
    throw new Error(`${environment === 'live' ? 'Live' : 'Sandbox'} M-Pesa credentials are not configured for this organization.`);
  }
  const accessToken = await getAccessToken(organizationId, environment);

  const payload = {
    ShortCode: credentials.shortcode,
    ResponseType: 'Completed',
    ConfirmationURL: c2bConfirmationUrl(),
    ValidationURL: c2bValidationUrl(),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${DARAJA_BASE_URLS[environment]}/mpesa/c2b/v1/registerurl`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal as AbortSignal,
    });
    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok) {
      logger.error(`Daraja C2B RegisterURL Error [${response.status}]:`, JSON.stringify(data));
      throw new Error(`Failed to register C2B URLs: ${response.status}`);
    }
    return data as RegisterC2BResponse;
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Daraja C2B RegisterURL failed:', message);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Payment gateway timed out while registering C2B URLs. Please try again.');
    }
    if (error instanceof Error && (message.startsWith('Failed to register') || message.includes('not configured'))) {
      throw error;
    }
    throw new Error('Failed to register C2B URLs.');
  }
}
