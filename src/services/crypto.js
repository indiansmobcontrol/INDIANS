// Members-only protection. The published data file is encrypted in the browser with a passphrase
// (PBKDF2-SHA256 key derivation, AES-256-GCM). Without the passphrase the file is unreadable.
const enc = new TextEncoder(), dec = new TextDecoder();
const ITER = 600000;
const toB64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const subtle = () => { const s = globalThis.crypto?.subtle; if (!s) throw new Error('This browser cannot do encryption here (it needs https).'); return s; };
async function deriveKey(pass, salt, iter, usage) {
  const base = await subtle().importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, usage);
}
export const isEncrypted = j => !!j && j.encrypted === true && j.v === 1 && typeof j.data === 'string';
/** Encrypt text with a passphrase. A fresh random salt and IV are used every time. */
export async function encryptText(text, pass, iter = ITER) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt, iter, ['encrypt']);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return { v: 1, encrypted: true, alg: 'AES-GCM-256/PBKDF2-SHA256', iter, salt: toB64(salt), iv: toB64(iv), data: toB64(ct) };
}
/** Decrypt a payload made by encryptText. Throws if the passphrase is wrong or the file was altered. */
export async function decryptText(payload, pass) {
  const key = await deriveKey(pass, fromB64(payload.salt), payload.iter, ['decrypt']);
  return dec.decode(await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(payload.iv) }, key, fromB64(payload.data)));
}
