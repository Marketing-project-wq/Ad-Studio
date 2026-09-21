// AES-256-GCM encryption for OAuth tokens at rest. Uses Node's built-in
// crypto (no dependency). Server-only — never import into client components.
//
// The key comes from ENCRYPTION_KEY. Accepted forms:
//   - 64 hex chars (32 bytes) — recommended: `openssl rand -hex 32`
//   - base64 that decodes to exactly 32 bytes
//   - any other string — hashed with SHA-256 to derive a 32-byte key
// Ciphertext format: "<ivBase64>:<authTagBase64>:<dataBase64>".

import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

export function isEncryptionConfigured(): boolean {
  return Boolean(process.env.ENCRYPTION_KEY);
}

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || '';
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY is not set. Generate one with `openssl rand -hex 32`.',
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  const asB64 = Buffer.from(raw, 'base64');
  if (asB64.length === 32) return asB64;
  // Deterministically derive 32 bytes from an arbitrary passphrase.
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed ciphertext');
  }
  const decipher = crypto.createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}
