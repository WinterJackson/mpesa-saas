import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync, privateDecrypt, constants } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  generateSecurityCredential,
  isCertificateConfigured,
  _clearCertCacheForTests,
} from './daraja-security-credential';

// Generate an RSA keypair as PEM strings; hand the public PEM to the module as
// if it were Safaricom's cert, then decrypt with the private key to prove the
// round-trip.
const { publicKey: publicPem, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

let dir: string;
let certPath: string;

beforeEach(() => {
  _clearCertCacheForTests();
  dir = mkdtempSync(path.join(tmpdir(), 'daraja-cert-'));
  certPath = path.join(dir, 'sandbox.cer');
  writeFileSync(certPath, publicPem);
  process.env.MPESA_SANDBOX_CERT_PATH = certPath;
  delete process.env.MPESA_PRODUCTION_CERT_PATH;
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.MPESA_SANDBOX_CERT_PATH;
  _clearCertCacheForTests();
});

describe('generateSecurityCredential', () => {
  it('produces a base64 credential that decrypts back to the initiator password', () => {
    const password = 'Safaricom999!*!';
    const credential = generateSecurityCredential(password, 'sandbox');

    // base64 shape
    expect(credential).toMatch(/^[A-Za-z0-9+/]+=*$/);

    // Round-trip: the holder of the private key recovers the plaintext.
    const decrypted = privateDecrypt(
      { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(credential, 'base64')
    );
    expect(decrypted.toString('utf8')).toBe(password);
  });

  it('throws a clear error when the password is empty', () => {
    expect(() => generateSecurityCredential('', 'sandbox')).toThrow(/initiator password is required/i);
  });

  it('throws a clear, actionable error when the cert is not configured', () => {
    delete process.env.MPESA_SANDBOX_CERT_PATH;
    _clearCertCacheForTests();
    expect(() => generateSecurityCredential('pw', 'sandbox')).toThrow(/certificate not configured/i);
  });

  it('produces a different ciphertext each call (PKCS#1 v1.5 randomized padding)', () => {
    const a = generateSecurityCredential('pw', 'sandbox');
    const b = generateSecurityCredential('pw', 'sandbox');
    expect(a).not.toBe(b);
  });
});

describe('isCertificateConfigured', () => {
  it('returns true when the cert exists and false when it does not', () => {
    expect(isCertificateConfigured('sandbox')).toBe(true);
    expect(isCertificateConfigured('live')).toBe(false);
  });
});
