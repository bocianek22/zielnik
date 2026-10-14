// Kopia danych zaszyfrowana hasłem (POM-57): szyfrowanie i odszyfrowanie na urządzeniu (WebCrypto), hasło nigdy nie
// trafia na serwer. PBKDF2-SHA-256 (600 000 iteracji, sól 16 B) wyprowadza klucz AES-GCM 256 (IV 12 B); plik to JSON
// z jawnym nagłówkiem (format, parametry) i szyfrogramem, więc import rozpoznaje go przed prośbą o hasło.
// Bez hasła danych nie da się odzyskać: tego nie obchodzimy (żadnej kopii hasła ani klucza po naszej stronie).
export const ENC_FORMAT = 'zielnik-kopia-szyfrowana';
export const PASSWORD_MIN = 8;
const ITER = 600000;

const b64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFrom(password, salt, iter, usage) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, [usage]);
}

export const isEncryptedBackup = (d) => !!d && typeof d === 'object' && d.format === ENC_FORMAT;

// tekst (JSON eksportu) -> tekst pliku zaszyfrowanej kopii
export async function encryptBackup(text, password) {
  if (String(password).length < PASSWORD_MIN) throw new Error(`Hasło musi mieć co najmniej ${PASSWORD_MIN} znaków.`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(password, salt, ITER, 'encrypt');
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
  return JSON.stringify({ format: ENC_FORMAT, v: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iter: ITER, salt: b64(salt) }, cipher: { name: 'AES-GCM', iv: b64(iv) }, data: b64(data) });
}

// obiekt pliku -> tekst JSON eksportu; zły klucz albo uszkodzony plik = błąd z prostym komunikatem
export async function decryptBackup(d, password) {
  if (!isEncryptedBackup(d) || d.v !== 1 || d.kdf?.name !== 'PBKDF2' || d.cipher?.name !== 'AES-GCM') throw new Error('Nieznany format zaszyfrowanej kopii.');
  const iter = Number(d.kdf.iter);
  if (!Number.isInteger(iter) || iter < 100000 || iter > 5000000) throw new Error('Nieznany format zaszyfrowanej kopii.');
  let salt, iv, data;
  try { salt = unb64(d.kdf.salt); iv = unb64(d.cipher.iv); data = unb64(d.data); } catch { throw new Error('Plik kopii jest uszkodzony.'); }
  try {
    const key = await keyFrom(String(password), salt, iter, 'decrypt');
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data));
  } catch { throw new Error('Złe hasło albo uszkodzony plik.'); }
}
