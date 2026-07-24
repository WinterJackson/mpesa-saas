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

    // Tamper with the encrypted data part (last segment: fingerprint:iv:authTag:data)
    const parts = ciphertext.split(':');
    const dataIndex = parts.length - 1;
    const originalData = Buffer.from(parts[dataIndex], 'base64');
    originalData[0] ^= 1; // flip a bit
    parts[dataIndex] = originalData.toString('base64');
    const tampered = parts.join(':');

    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('handles null properly', () => {
    expect(decryptSecret(null)).toBeNull();
  });

  it('decrypts legacy 3-part ciphertext (no key fingerprint) under the current key', () => {
    // Simulates a row encrypted before key-rotation support existed.
    const plaintext = 'legacy_value';
    const fingerprinted = encryptSecret(plaintext);
    const [, iv, tag, data] = fingerprinted.split(':');
    const legacy = `${iv}:${tag}:${data}`;

    expect(decryptSecret(legacy)).toBe(plaintext);
  });

  describe('key rotation', () => {
    const oldKeyB64 = Buffer.from('12345678901234567890123456789012').toString('base64');
    const newKeyB64 = Buffer.from('abcdefghijklmnopqrstuvwxyzabcdef').toString('base64');

    it('decrypts a value written under the previous key once ENCRYPTION_KEY_PREVIOUS is set', () => {
      process.env.ENCRYPTION_KEY = oldKeyB64;
      const ciphertext = encryptSecret('rotated_value');

      // Rotate: new key becomes current, old key becomes the previous key.
      process.env.ENCRYPTION_KEY = newKeyB64;
      process.env.ENCRYPTION_KEY_PREVIOUS = oldKeyB64;

      expect(decryptSecret(ciphertext)).toBe('rotated_value');
    });

    it('new writes after rotation use the new (current) key', () => {
      process.env.ENCRYPTION_KEY = oldKeyB64;
      process.env.ENCRYPTION_KEY_PREVIOUS = undefined;
      process.env.ENCRYPTION_KEY = newKeyB64;
      process.env.ENCRYPTION_KEY_PREVIOUS = oldKeyB64;

      const ciphertext = encryptSecret('freshly_written');

      // Even with the previous key still configured, a value round-trips
      // correctly — proving new writes aren't accidentally tied to the old key.
      expect(decryptSecret(ciphertext)).toBe('freshly_written');

      // And it fails if the "previous" key is removed and doesn't match the
      // fingerprint the current key would have produced for THIS write, i.e.
      // the ciphertext really was written under the current key.
      process.env.ENCRYPTION_KEY_PREVIOUS = undefined;
      expect(decryptSecret(ciphertext)).toBe('freshly_written');
    });

    it('throws a clear error when no configured key matches the ciphertext fingerprint', () => {
      process.env.ENCRYPTION_KEY = oldKeyB64;
      const ciphertext = encryptSecret('orphaned_value');

      // Rotate away from the old key with no ENCRYPTION_KEY_PREVIOUS set at all.
      process.env.ENCRYPTION_KEY = newKeyB64;
      process.env.ENCRYPTION_KEY_PREVIOUS = undefined;

      expect(() => decryptSecret(ciphertext)).toThrow(/no configured key/i);
    });
  });
});
