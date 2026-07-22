import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey } from './api-keys';

describe('api-keys', () => {
  it('generates keys starting with pk_', () => {
    const key = generateApiKey();
    expect(key.raw.startsWith('pk_')).toBe(true);
  });

  it('hashApiKey is deterministic', () => {
    const raw = 'pk_test123';
    expect(hashApiKey(raw)).toBe(hashApiKey(raw));
  });

  it('generates unique keys across calls', () => {
    const keys = Array.from({ length: 100 }, () => generateApiKey().raw);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(100);
  });

  it('keyPrefix is a true prefix of raw', () => {
    const key = generateApiKey();
    expect(key.raw.startsWith(key.keyPrefix)).toBe(true);
    expect(key.keyPrefix.length).toBe(12);
  });
});
