// Decifra site/data.enc: salt(16) || nonce(12) || AES-256-GCM. Speculare a scraper/crypto.py.
const SALT = 16, NONCE = 12, TAG = 16;

export async function decifra(blob, password, iterazioni) {
  const b = new Uint8Array(blob);
  if (b.length < SALT + NONCE + TAG) throw new Error('PASSWORD_ERRATA');
  const salt = b.slice(0, SALT), nonce = b.slice(SALT, SALT + NONCE), ct = b.slice(SALT + NONCE);
  const materiale = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const chiave = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: iterazioni, hash: 'SHA-256' },
    materiale, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  let chiaro;
  try {
    chiaro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, chiave, ct);
  } catch {
    throw new Error('PASSWORD_ERRATA');
  }
  return JSON.parse(new TextDecoder().decode(chiaro));
}
