import { randomBytes, createHash } from 'node:crypto';

export interface GeneratedApiKey {
  raw: string;
  keyHash: string;
  keyPrefix: string;
}

const KEY_BYTE_LENGTH = 24; // preserves today's 48-hex-char length from the existing pk_ format
const PREFIX_VISIBLE_CHARS = 12; // e.g. "pk_a1b2c3d4" — enough for a merchant to recognize which key without exposing the secret

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export function generateApiKey(): GeneratedApiKey {
  const raw = `pk_${randomBytes(KEY_BYTE_LENGTH).toString('hex')}`;
  return {
    raw,
    keyHash: hashApiKey(raw),
    keyPrefix: raw.slice(0, PREFIX_VISIBLE_CHARS),
  };
}
