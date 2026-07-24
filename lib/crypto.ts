import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
// Length of the key fingerprint prefix used to select the right key at
// decrypt time during a rotation window — see the module doc comment below.
const FINGERPRINT_LENGTH = 8;

function decodeKey(keyB64: string, envVarName: string): Buffer {
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) throw new Error(`${envVarName} must be base64 for exactly 32 bytes (AES-256)`);
  return key;
}

function getCurrentKey(): Buffer {
  const keyB64 = process.env.ENCRYPTION_KEY;
  if (!keyB64) throw new Error('ENCRYPTION_KEY environment variable is not set');
  return decodeKey(keyB64, 'ENCRYPTION_KEY');
}

// Set only during a key-rotation window: the key every existing row was
// encrypted under before ENCRYPTION_KEY was rotated to a new value. Absent
// the rest of the time.
function getPreviousKey(): Buffer | null {
  const keyB64 = process.env.ENCRYPTION_KEY_PREVIOUS;
  if (!keyB64) return null;
  return decodeKey(keyB64, 'ENCRYPTION_KEY_PREVIOUS');
}

// Short, non-secret fingerprint identifying which key produced a ciphertext,
// so decryption can pick the right one out of {current, previous} without
// needing an external version counter. Not sensitive: it's a one-way hash
// prefix, not the key itself, and knowing it doesn't help decrypt anything.
function fingerprint(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, FINGERPRINT_LENGTH);
}

/**
 * Key-rotation procedure (see AGENTS.md for the full runbook): set
 * ENCRYPTION_KEY_PREVIOUS to the current ENCRYPTION_KEY's value, set
 * ENCRYPTION_KEY to a newly generated key, deploy. New writes are encrypted
 * under the new key immediately; existing rows keep decrypting correctly via
 * ENCRYPTION_KEY_PREVIOUS until they're next re-encrypted (e.g. on their next
 * update) or backfilled by a one-off script. Once no row depends on the old
 * key anymore, drop ENCRYPTION_KEY_PREVIOUS.
 */
export function encryptSecret(plaintext: string): string {
  const key = getCurrentKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${fingerprint(key)}:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(ciphertext: string): string;
export function decryptSecret(ciphertext: string | null | undefined): string | null;
export function decryptSecret(ciphertext: string | null | undefined): string | null {
  if (ciphertext == null) return null;
  const parts = ciphertext.split(':');

  let key: Buffer;
  let ivB64: string;
  let tagB64: string;
  let dataB64: string;

  if (parts.length === 4) {
    // Fingerprinted format: <keyFingerprint>:<iv>:<authTag>:<data>
    const [fp, iv, tag, data] = parts;
    ivB64 = iv;
    tagB64 = tag;
    dataB64 = data;

    const current = getCurrentKey();
    const previous = getPreviousKey();
    if (fp === fingerprint(current)) {
      key = current;
    } else if (previous && fp === fingerprint(previous)) {
      key = previous;
    } else {
      throw new Error(
        "Cannot decrypt: no configured key (ENCRYPTION_KEY / ENCRYPTION_KEY_PREVIOUS) matches this value's fingerprint"
      );
    }
  } else if (parts.length === 3) {
    // Legacy format written before key-rotation support existed (no
    // fingerprint prefix) — always decrypted under the current key, exactly
    // as before this change, so every already-encrypted row keeps working.
    [ivB64, tagB64, dataB64] = parts;
    key = getCurrentKey();
  } else {
    throw new Error('Malformed encrypted value (expected iv:authTag:data or fingerprint:iv:authTag:data)');
  }

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}
