// Szyfrowanie wybranych kolumn z notatkami (POM-28, docs/SZYFROWANIE-NOTATEK.md): AES-256-GCM, klucze w env.
// Moduł jest synchroniczny i bez zależności od bazy (działa też w skryptach i testach jednostkowych).
//
// DATA_ENCRYPTION_KEY="k2:<base64-32B>,k1:<base64-32B>": pierwszy klucz szyfruje, pozostałe tylko odszyfrowują (rotacja).
// Bez zmiennej funkcja jest wyłączona: zapis jawny, a szyfrogramy z przeszłości nie dają się odczytać (znacznik zamiast treści).
// Szyfrogram: zenc1:<kid>:<base64(iv12 ‖ tag16 ‖ ct)>; AAD: zielnik|<tabela>.<kolumna>|<właściciel> (user_id, a dla strain_tests id wiersza),
// więc szyfrogramu nie da się przenieść do innego konta, kolumny ani wiersza. Pusty tekst zostaje '' (warunki note <> '' działają bez zmian).
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const PREFIX = 'zenc1:';
export const LOCKED_NOTE = '[notatka zaszyfrowana, brak klucza]';
// Kolumny objęte szyfrowaniem: tabela, kolumna, klucz główny (kursor skryptu), pole właściciela w AAD.
// TODO(POM-28): doctor_notes.text czeka na decyzję właściciela o CHECK 1..200 (docs/SZYFROWANIE-NOTATEK.md, „Wyjątek”)
export const COLUMNS = [
  { table: 'symptom_log', col: 'note', pk: ['user_id', 'day'], owner: 'user_id' },
  { table: 'user_strain', col: 'notes', pk: ['strain_id', 'user_id'], owner: 'user_id' },
  { table: 'prescriptions', col: 'note', pk: ['id'], owner: 'user_id' },
  { table: 'strain_tests', col: 'note', pk: ['id'], owner: 'id' },
];

const IV_LEN = 12;
const TAG_LEN = 16;
const KID_RE = /^[A-Za-z0-9_-]{1,16}$/;
let cache = { raw: null, parsed: null };

// Lista kluczy z wartości env; wyjątek przy złym formacie. Pusta wartość => [].
export function parseKeys(raw) {
  const s = (raw || '').trim();
  if (!s) return [];
  const seen = new Set();
  return s.split(',').map((part) => {
    const i = part.indexOf(':');
    const kid = part.slice(0, i).trim(), b64 = part.slice(i + 1).trim();
    if (i < 1 || !KID_RE.test(kid)) throw new Error('DATA_ENCRYPTION_KEY: oczekiwany format kid:base64 (kid: litery, cyfry, - i _).');
    if (seen.has(kid)) throw new Error('DATA_ENCRYPTION_KEY: powtórzony identyfikator klucza.');
    seen.add(kid);
    const key = Buffer.from(b64, 'base64');
    if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY: każdy klucz musi mieć 32 bajty w base64.');
    return { kid, key };
  });
}

// Klucze z env, z pamięcią podręczną na instancję (przeliczane tylko po zmianie wartości zmiennej).
function keys() {
  const raw = process.env.DATA_ENCRYPTION_KEY || '';
  if (cache.raw !== raw) {
    let parsed;
    try { parsed = { list: parseKeys(raw), error: null }; } catch (e) { parsed = { list: [], error: e.message }; }
    cache = { raw, parsed };
  }
  return cache.parsed;
}

// Stan do panelu Gotowość: off (brak zmiennej), ok albo invalid (zły format); kids to identyfikatory, nigdy wartości.
export function keyStatus() {
  const { list, error } = keys();
  return { state: error ? 'invalid' : list.length ? 'ok' : 'off', kids: list.map((k) => k.kid), primary: list[0]?.kid ?? null };
}

export const isEncrypted = (s) => typeof s === 'string' && s.startsWith(PREFIX);
export const kidOf = (s) => (isEncrypted(s) ? s.slice(PREFIX.length).split(':')[0] : null);
const aad = (table, col, owner) => Buffer.from(`zielnik|${table}.${col}|${owner}`);

// Zapis: z kluczem szyfrogram, bez klucza (funkcja wyłączona) jawny tekst. Zły format klucza => wyjątek
// (zapis jawny po cichu byłby gorszy niż odmowa; panel Gotowość pokazuje wtedy „weak”).
export function encryptField(table, col, owner, text) {
  const s = text == null ? '' : String(text);
  if (!s) return '';
  const { list, error } = keys();
  if (error) throw new Error(error);
  if (!list.length) return s;
  const { kid, key } = list[0];
  const iv = randomBytes(IV_LEN);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(aad(table, col, owner));
  const ct = Buffer.concat([c.update(s, 'utf8'), c.final()]);
  return `${PREFIX}${kid}:${Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64')}`;
}

let lastLog = 0;
function report(table, col, why) {
  const now = Date.now();
  if (now - lastLog < 60_000) return; // jeden wpis na minutę: odczyt listy nie zalewa dziennika
  lastLog = now;
  // bez treści i bez właściciela; dynamiczny import, by moduł nie wymagał bazy (skrypty, testy jednostkowe)
  import('./errorlog.js').then((m) => m.logError('szyfrowanie', new Error(`Nie odszyfrowano ${table}.${col}: ${why}`))).catch(() => {});
}

// Odszyfrowanie pola `field` w liście wierszy (owner: stała albo funkcja wiersza); wiersze bez wartości bez zmian.
export const openRows = (rows, table, col, owner, field = col) => rows.map((r) => (r[field]
  ? { ...r, [field]: decryptField(table, col, typeof owner === 'function' ? owner(r) : owner, r[field]) } : r));

// Kopia zapasowa ({ <tabela>: [wiersze] }): odszyfrowuje notatki w miejscu (backup-decrypt --data-key).
// Zwraca liczby: odszyfrowane i nieodczytane (te zostają szyfrogramem).
export function decryptBackupData(data) {
  const out = { decrypted: 0, failed: 0 };
  for (const { table, col, owner } of COLUMNS) {
    for (const r of data[table] || []) {
      if (!isEncrypted(r[col])) continue;
      try { r[col] = decryptStrict(table, col, r[owner], r[col]); out.decrypted++; } catch { out.failed++; }
    }
  }
  return out;
}

// Surowa odwrotność; wyjątek przy złym kluczu, AAD albo uszkodzeniu (używa skrypt przepisujący).
export function decryptStrict(table, col, owner, stored) {
  const rest = stored.slice(PREFIX.length);
  const i = rest.indexOf(':');
  if (i < 1) throw new Error('uszkodzony szyfrogram');
  const k = keys().list.find((x) => x.kid === rest.slice(0, i));
  if (!k) throw new Error('brak klucza o tym identyfikatorze');
  const buf = Buffer.from(rest.slice(i + 1), 'base64');
  if (buf.length < IV_LEN + TAG_LEN) throw new Error('uszkodzony szyfrogram');
  const d = createDecipheriv('aes-256-gcm', k.key, buf.subarray(0, IV_LEN));
  d.setAAD(aad(table, col, owner));
  d.setAuthTag(buf.subarray(IV_LEN, IV_LEN + TAG_LEN));
  return Buffer.concat([d.update(buf.subarray(IV_LEN + TAG_LEN)), d.final()]).toString('utf8');
}

// Odczyt: tekst bez prefiksu wraca bez zmian (wiersze sprzed włączenia szyfrowania); szyfrogram, którego nie da się
// odszyfrować (brak klucza, zły AAD, uszkodzenie), daje znacznik i wpis w dzienniku błędów bez treści.
export function decryptField(table, col, owner, stored) {
  if (stored == null || stored === '') return '';
  if (!isEncrypted(stored)) return String(stored);
  try {
    return decryptStrict(table, col, owner, stored);
  } catch (e) {
    report(table, col, keys().error ? 'zły format klucza' : e.message);
    return LOCKED_NOTE;
  }
}
