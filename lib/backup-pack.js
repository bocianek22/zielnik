// Pakowanie kopii zapasowej: gzip + opcjonalne szyfrowanie AES-256-GCM (funkcje czyste, bez bazy i sieci).
//
// Format pliku zaszyfrowanego (.json.gz.enc):
//   bajty 0-3    "ZBK1" (znacznik formatu i wersji; wchodzi też do uwierzytelnionych danych dodatkowych AAD)
//   bajty 4-15   iv (12 losowych bajtów, nowy dla każdej kopii)
//   bajty 16-31  tag uwierzytelniający GCM (16 bajtów)
//   bajty 32-    szyfrogram z gzip(JSON)
// Plik niezaszyfrowany to zwykły gzip (.json.gz, zaczyna się od 1f 8b).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

const MAGIC = Buffer.from('ZBK1');
const IV_LEN = 12;
const TAG_LEN = 16;

// Klucz: 32 bajty w base64 (np. `openssl rand -base64 32`). Pusty => bez szyfrowania.
export function parseKey(b64) {
  const s = (b64 || '').trim();
  if (!s) return null;
  const key = Buffer.from(s, 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY musi mieć 32 bajty w base64.');
  return key;
}

export const isEncrypted = (buf) => buf.length >= MAGIC.length && buf.subarray(0, MAGIC.length).equals(MAGIC);

export function packBackup(json, keyB64) {
  const gz = gzipSync(Buffer.from(json, 'utf8'));
  const key = parseKey(keyB64);
  if (!key) return gz;
  const iv = randomBytes(IV_LEN);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(MAGIC);
  const body = Buffer.concat([c.update(gz), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), body]);
}

// Odwrotność packBackup: zwraca tekst JSON. Zły klucz lub uszkodzony plik => wyjątek.
export function unpackBackup(buf, keyB64) {
  if (!isEncrypted(buf)) return gunzipSync(buf).toString('utf8');
  const key = parseKey(keyB64);
  if (!key) throw new Error('Plik jest zaszyfrowany: podaj klucz (BACKUP_ENCRYPTION_KEY).');
  if (buf.length < MAGIC.length + IV_LEN + TAG_LEN) throw new Error('Uszkodzony plik kopii.');
  const iv = buf.subarray(MAGIC.length, MAGIC.length + IV_LEN);
  const tag = buf.subarray(MAGIC.length + IV_LEN, MAGIC.length + IV_LEN + TAG_LEN);
  const d = createDecipheriv('aes-256-gcm', key, iv);
  d.setAAD(MAGIC);
  d.setAuthTag(tag);
  try {
    return gunzipSync(Buffer.concat([d.update(buf.subarray(MAGIC.length + IV_LEN + TAG_LEN)), d.final()])).toString('utf8');
  } catch {
    throw new Error('Nie udało się odszyfrować kopii (zły klucz albo uszkodzony plik).');
  }
}
