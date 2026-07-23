import { publicEncrypt, constants } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─── Daraja SecurityCredential (B2C / Reversal / Account Balance / Tx Status) ──
//
// Daraja's non-STK financial APIs authenticate the operator via a
// `SecurityCredential`: the initiator's plaintext password, RSA-encrypted with
// Safaricom's public certificate (a DIFFERENT cert for sandbox vs production)
// using PKCS#1 v1.5 padding, then base64-encoded.
//
// The certificate is a PUBLIC key — safe to hold — but we git-ignore `certs/`
// by convention. The cert is optional-until-used: these functions throw a clear
// error only when a B2C/reversal/balance call actually needs a credential and no
// cert is configured (same pattern as R2 storage in lib/storage.ts).

type DarajaEnvironment = 'sandbox' | 'live';

// In-process cache so we read + parse each cert file at most once.
const certCache = new Map<DarajaEnvironment, string>();

function resolveCertPath(environment: DarajaEnvironment): string {
  const fromEnv =
    environment === 'live'
      ? process.env.MPESA_PRODUCTION_CERT_PATH
      : process.env.MPESA_SANDBOX_CERT_PATH;
  if (fromEnv) return fromEnv;
  // Default location: certs/sandbox.cer or certs/production.cer at the repo root.
  const file = environment === 'live' ? 'production.cer' : 'sandbox.cer';
  return path.join(process.cwd(), 'certs', file);
}

function loadCert(environment: DarajaEnvironment): string {
  const cached = certCache.get(environment);
  if (cached) return cached;

  const certPath = resolveCertPath(environment);
  let raw: string;
  try {
    raw = readFileSync(certPath, 'utf8');
  } catch {
    throw new Error(
      `Safaricom ${environment} certificate not configured — expected a PEM/CER file at "${certPath}" ` +
        `(or set ${environment === 'live' ? 'MPESA_PRODUCTION_CERT_PATH' : 'MPESA_SANDBOX_CERT_PATH'}). ` +
        `Download the ${environment} public certificate from the Daraja portal.`
    );
  }

  const pem = normalizeToPem(raw);
  certCache.set(environment, pem);
  return pem;
}

// Safaricom distributes the cert as a `.cer`. Accept a PEM block directly, or a
// bare base64 body (wrap it into a CERTIFICATE PEM), or a full PEM already.
function normalizeToPem(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes('-----BEGIN')) return trimmed;
  const body = trimmed.replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g)?.join('\n') ?? body;
  return `-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----`;
}

/**
 * Produces a Daraja `SecurityCredential` for the given environment: the
 * initiator password RSA-encrypted (PKCS#1 v1.5) with Safaricom's public
 * certificate, base64-encoded. Throws a clear error if the cert isn't configured.
 */
export function generateSecurityCredential(
  initiatorPassword: string,
  environment: DarajaEnvironment
): string {
  if (!initiatorPassword) {
    throw new Error('Initiator password is required to generate a SecurityCredential.');
  }
  const certPem = loadCert(environment);
  const encrypted = publicEncrypt(
    { key: certPem, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(initiatorPassword, 'utf8')
  );
  return encrypted.toString('base64');
}

/** Whether a Safaricom certificate is available for the given environment (no throw). */
export function isCertificateConfigured(environment: DarajaEnvironment): boolean {
  try {
    loadCert(environment);
    return true;
  } catch {
    return false;
  }
}

/** Test-only: clears the in-process certificate cache. */
export function _clearCertCacheForTests(): void {
  certCache.clear();
}
