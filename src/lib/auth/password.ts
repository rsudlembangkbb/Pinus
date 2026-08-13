/**
 * Password hashing using PBKDF2-HMAC-SHA256 via the WebCrypto SubtleCrypto
 * API. bcrypt/argon2 native bindings do not run in the Workers V8 isolate
 * runtime, so PBKDF2 (natively supported by WebCrypto, available in every
 * Workers/Pages runtime) is used instead, per NIST SP 800-63B guidance for
 * a memory-constrained edge environment. Iteration count is tuned high
 * enough to remain expensive to brute force while staying within Workers
 * CPU budgets for a login request.
 */

const ITERATIONS = 210_000;
const KEY_LENGTH_BITS = 256;
const ALGO = 'PBKDF2';

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), ALGO, false, [
    'deriveBits'
  ]);
  return crypto.subtle.deriveBits(
    { name: ALGO, salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH_BITS
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await deriveKey(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt.buffer)}$${toBase64(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = fromBase64(parts[2] as string);
  const expectedHash = parts[3] as string;
  const derived = await deriveKey(password, salt, iterations);
  const actualHash = toBase64(derived);
  return timingSafeEqual(actualHash, expectedHash);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 10) return 'Kata sandi minimal 10 karakter.';
  if (!/[A-Z]/.test(password)) return 'Kata sandi harus mengandung huruf besar.';
  if (!/[a-z]/.test(password)) return 'Kata sandi harus mengandung huruf kecil.';
  if (!/[0-9]/.test(password)) return 'Kata sandi harus mengandung angka.';
  return null;
}
