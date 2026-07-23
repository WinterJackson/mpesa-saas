import { prisma } from '@/lib/db';
import { encryptSecret, decryptSecret } from '@/lib/crypto';

export interface DarajaCredentialSet {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
}

/**
 * Seeds a brand-new organization's pooled/PaySwift-managed sandbox credentials
 * at onboarding time (see app/api/merchant/setup/route.ts). This is the only
 * place PaySwift's own MPESA_* env vars are read into a per-organization row —
 * lib/daraja.ts never reads process.env directly after this.
 */
export async function seedPooledSandboxCredential(
  organizationId: string,
  sandbox: DarajaCredentialSet
) {
  return prisma.organizationDarajaCredential.create({
    data: {
      organizationId,
      consumerKeyEncrypted: encryptSecret(sandbox.consumerKey),
      consumerSecretEncrypted: encryptSecret(sandbox.consumerSecret),
      shortcode: sandbox.shortcode,
      passkeyEncrypted: encryptSecret(sandbox.passkey),
      callbackUrl: sandbox.callbackUrl,
      isPooledSandbox: true,
    },
  });
}

/**
 * Resolves and decrypts an organization's Daraja credentials for the given
 * environment. Returns null if no row exists, or if `live` was requested but
 * the organization hasn't supplied its own live credentials yet (Model B —
 * live credentials are always the organization's own, never pooled).
 */
export async function getDecryptedCredentials(
  organizationId: string,
  environment: 'sandbox' | 'live'
): Promise<DarajaCredentialSet | null> {
  const row = await prisma.organizationDarajaCredential.findUnique({ where: { organizationId } });
  if (!row) return null;

  if (environment === 'live') {
    if (
      !row.consumerKeyLiveEncrypted ||
      !row.consumerSecretLiveEncrypted ||
      !row.shortcodeLive ||
      !row.passkeyLiveEncrypted ||
      !row.callbackUrlLive
    ) {
      return null;
    }
    return {
      consumerKey: decryptSecret(row.consumerKeyLiveEncrypted)!,
      consumerSecret: decryptSecret(row.consumerSecretLiveEncrypted)!,
      shortcode: row.shortcodeLive,
      passkey: decryptSecret(row.passkeyLiveEncrypted)!,
      callbackUrl: row.callbackUrlLive,
    };
  }

  return {
    consumerKey: decryptSecret(row.consumerKeyEncrypted)!,
    consumerSecret: decryptSecret(row.consumerSecretEncrypted)!,
    shortcode: row.shortcode,
    passkey: decryptSecret(row.passkeyEncrypted)!,
    callbackUrl: row.callbackUrl,
  };
}

export async function isLiveCredentialConfigured(organizationId: string): Promise<boolean> {
  const row = await prisma.organizationDarajaCredential.findUnique({
    where: { organizationId },
    select: {
      consumerKeyLiveEncrypted: true,
      consumerSecretLiveEncrypted: true,
      shortcodeLive: true,
      passkeyLiveEncrypted: true,
      callbackUrlLive: true,
    },
  });
  if (!row) return false;
  return Boolean(
    row.consumerKeyLiveEncrypted &&
    row.consumerSecretLiveEncrypted &&
    row.shortcodeLive &&
    row.passkeyLiveEncrypted &&
    row.callbackUrlLive
  );
}

export async function setLiveCredential(organizationId: string, live: DarajaCredentialSet) {
  return prisma.organizationDarajaCredential.update({
    where: { organizationId },
    data: {
      consumerKeyLiveEncrypted: encryptSecret(live.consumerKey),
      consumerSecretLiveEncrypted: encryptSecret(live.consumerSecret),
      shortcodeLive: live.shortcode,
      passkeyLiveEncrypted: encryptSecret(live.passkey),
      callbackUrlLive: live.callbackUrl,
    },
  });
}

export interface CredentialSummary {
  sandboxShortcode: string | null;
  isPooledSandbox: boolean;
  liveShortcode: string | null;
  hasLiveCredentials: boolean;
}

/**
 * Non-secret summary for the settings UI — never returns decrypted
 * consumerSecret/passkey values, only the (non-secret) shortcode and
 * whether each environment's credentials are configured.
 */
export async function getCredentialSummary(organizationId: string): Promise<CredentialSummary | null> {
  const row = await prisma.organizationDarajaCredential.findUnique({
    where: { organizationId },
    select: { shortcode: true, isPooledSandbox: true, shortcodeLive: true },
  });
  if (!row) return null;

  return {
    sandboxShortcode: row.shortcode,
    isPooledSandbox: row.isPooledSandbox,
    liveShortcode: row.shortcodeLive,
    hasLiveCredentials: Boolean(row.shortcodeLive),
  };
}

export async function setSandboxCredential(organizationId: string, sandbox: DarajaCredentialSet) {
  return prisma.organizationDarajaCredential.update({
    where: { organizationId },
    data: {
      consumerKeyEncrypted: encryptSecret(sandbox.consumerKey),
      consumerSecretEncrypted: encryptSecret(sandbox.consumerSecret),
      shortcode: sandbox.shortcode,
      passkeyEncrypted: encryptSecret(sandbox.passkey),
      callbackUrl: sandbox.callbackUrl,
      isPooledSandbox: false,
    },
  });
}
