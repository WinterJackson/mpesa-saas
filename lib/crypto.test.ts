import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptSecret, decryptSecret } from './crypto';

describe('crypto', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // 32-byte key in base64
    process.env.ENCRYPTION_KEY = Buffer.from('12345678901234567890123456789012').toString('base64');
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('round-trips successfully', () => {
    const plaintext = 'super_secret_value';
    const ciphertext = encryptSecret(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decryptSecret(ciphertext)).toBe(plaintext);
  });

  it('generates different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'test_value';
    const c1 = encryptSecret(plaintext);
    const c2 = encryptSecret(plaintext);
    expect(c1).not.toBe(c2);
  });

  it('throws on tampered ciphertext (auth tag check)', () => {
    const plaintext = 'test_value';
    const ciphertext = encryptSecret(plaintext);
    
    // Tamper with the encrypted data part
    const parts = ciphertext.split(':');
    const originalData = Buffer.from(parts[2], 'base64');
    originalData[0] ^= 1; // flip a bit
    parts[2] = originalData.toString('base64');
    const tampered = parts.join(':');

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('handles null properly', () => {
    expect(decryptSecret(null)).toBeNull();
  });
});
