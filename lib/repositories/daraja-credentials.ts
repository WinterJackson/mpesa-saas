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
  hasSandboxInitiator: boolean;
  hasLiveInitiator: boolean;
}

/**
 * Non-secret summary for the settings UI — never returns decrypted
 * consumerSecret/passkey/initiator values, only the (non-secret) shortcode and
 * whether each environment's credentials are configured.
 */
export async function getCredentialSummary(organizationId: string): Promise<CredentialSummary | null> {
  const row = await prisma.organizationDarajaCredential.findUnique({
    where: { organizationId },
    select: {
      shortcode: true,
      isPooledSandbox: true,
      shortcodeLive: true,
      initiatorName: true,
      initiatorPasswordEncrypted: true,
      initiatorNameLive: true,
      initiatorPasswordLiveEncrypted: true,
    },
  });
  if (!row) return null;

  return {
    sandboxShortcode: row.shortcode,
    isPooledSandbox: row.isPooledSandbox,
    liveShortcode: row.shortcodeLive,
    hasLiveCredentials: Boolean(row.shortcodeLive),
    hasSandboxInitiator: Boolean(row.initiatorName && row.initiatorPasswordEncrypted),
    hasLiveInitiator: Boolean(row.initiatorNameLive && row.initiatorPasswordLiveEncrypted),
  };
}

// ─── Shortcode → organization resolution (for C2B confirmations) ────────────
// A C2B confirmation carries only the BusinessShortCode. Match a live shortcode,
// or a non-pooled sandbox shortcode (the pooled sandbox 174379 is shared across
// orgs and therefore not uniquely attributable — those are skipped).
export async function findOrgContextByShortcode(shortcode: string): Promise<
  | { organizationId: string; merchantId: string; environment: 'sandbox' | 'live' }
  | null
> {
  const row = await prisma.organizationDarajaCredential.findFirst({
    where: {
      OR: [{ shortcodeLive: shortcode }, { shortcode, isPooledSandbox: false }],
    },
    include: { organization: { include: { merchant: true } } },
  });
  if (!row || !row.organization.merchant) return null;
  const environment: 'sandbox' | 'live' = row.shortcodeLive === shortcode ? 'live' : 'sandbox';
  return {
    organizationId: row.organizationId,
    merchantId: row.organization.merchant.id,
    environment,
  };
}

// ─── B2C / Reversal / Balance initiator credentials ────────────────────────

export interface InitiatorCredential {
  name: string;
  password: string;
}

/**
 * Resolves an organization's initiator name + decrypted password for the given
 * environment (used to produce the SecurityCredential). Returns null if not set.
 */
export async function getDecryptedInitiator(
  organizationId: string,
  environment: 'sandbox' | 'live'
): Promise<InitiatorCredential | null> {
  const row = await prisma.organizationDarajaCredential.findUnique({ where: { organizationId } });
  if (!row) return null;

  if (environment === 'live') {
    if (!row.initiatorNameLive || !row.initiatorPasswordLiveEncrypted) return null;
    return { name: row.initiatorNameLive, password: decryptSecret(row.initiatorPasswordLiveEncrypted)! };
  }
  if (!row.initiatorName || !row.initiatorPasswordEncrypted) return null;
  return { name: row.initiatorName, password: decryptSecret(row.initiatorPasswordEncrypted)! };
}

export async function setInitiatorCredential(
  organizationId: string,
  environment: 'sandbox' | 'live',
  initiator: InitiatorCredential
) {
  const data =
    environment === 'live'
      ? { initiatorNameLive: initiator.name, initiatorPasswordLiveEncrypted: encryptSecret(initiator.password) }
      : { initiatorName: initiator.name, initiatorPasswordEncrypted: encryptSecret(initiator.password) };
  return prisma.organizationDarajaCredential.update({ where: { organizationId }, data });
}

export async function isInitiatorConfigured(
  organizationId: string,
  environment: 'sandbox' | 'live'
): Promise<boolean> {
  const row = await prisma.organizationDarajaCredential.findUnique({
    where: { organizationId },
    select: {
      initiatorName: true,
      initiatorPasswordEncrypted: true,
      initiatorNameLive: true,
      initiatorPasswordLiveEncrypted: true,
    },
  });
  if (!row) return false;
  return environment === 'live'
    ? Boolean(row.initiatorNameLive && row.initiatorPasswordLiveEncrypted)
    : Boolean(row.initiatorName && row.initiatorPasswordEncrypted);
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
