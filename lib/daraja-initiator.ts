import { DARAJA_BASE_URLS, getAccessToken } from '@/lib/daraja';
import { getDecryptedCredentials, getDecryptedInitiator } from '@/lib/repositories/daraja-credentials';
import { generateSecurityCredential } from '@/lib/daraja-security-credential';
import { withApiSpan } from '@/lib/tracing';
import { logger } from '@/lib/logger';

// Shared plumbing for the initiator-authenticated Daraja commands (Transaction
// Status, Account Balance, Reversal). All resolve per-org credentials + initiator
// and RSA-sign a SecurityCredential, then POST with Result/Timeout callback URLs.

export interface InitiatorAuth {
  shortcode: string;
  initiatorName: string;
  securityCredential: string;
  accessToken: string;
}

export interface DarajaCommandResponse {
  OriginatorConversationID: string;
  ConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

export async function buildInitiatorAuth(
  organizationId: string,
  environment: 'sandbox' | 'live'
): Promise<InitiatorAuth> {
  const credentials = await getDecryptedCredentials(organizationId, environment);
  if (!credentials) {
    throw new Error(`${environment === 'live' ? 'Live' : 'Sandbox'} M-Pesa credentials are not configured for this organization.`);
  }
  const initiator = await getDecryptedInitiator(organizationId, environment);
  if (!initiator) {
    throw new Error(`Initiator credentials are not configured for this organization (${environment}). Add them under Payment Setup.`);
  }
  return {
    shortcode: credentials.shortcode,
    initiatorName: initiator.name,
    securityCredential: generateSecurityCredential(initiator.password, environment),
    accessToken: await getAccessToken(organizationId, environment),
  };
}

export async function postInitiatorCommand(
  environment: 'sandbox' | 'live',
  path: string,
  payload: Record<string, unknown>,
  accessToken: string,
  opName: string,
  organizationId: string
): Promise<DarajaCommandResponse> {
  return withApiSpan(`daraja.${opName.toLowerCase().replace(/\s+/g, '_')}`, 'http.client', organizationId, async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${DARAJA_BASE_URLS[environment]}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal as AbortSignal,
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      if (!response.ok) {
        logger.error(`Daraja ${opName} Error [${response.status}]:`, JSON.stringify(data));
        throw new Error(`Payment gateway rejected the ${opName} request: ${response.status}`);
      }
      return data as DarajaCommandResponse;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Daraja ${opName} failed:`, message);
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Payment gateway timed out during the ${opName} request. Please try again.`);
      }
      if (error instanceof Error && (message.startsWith('Payment gateway') || message.includes('not configured'))) {
        throw error;
      }
      throw new Error(`Failed to complete the ${opName} request.`);
    }
  });
}
