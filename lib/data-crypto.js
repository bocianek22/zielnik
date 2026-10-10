// Szyfrowanie wybranych kolumn z notatkami (POM-28, docs/SZYFROWANIE-NOTATEK.md): AES-256-GCM, klucze w env.
// Moduł jest synchroniczny i bez zależności od bazy (działa też w skryptach i testach jednostkowych).
//
// DATA_ENCRYPTION_KEY="k2:<base64-32B>,k1:<base64-32B>": pierwszy klucz szyfruje, pozostałe tylko odszyfrowują (rotacja).
// Bez zmiennej funkcja jest wyłączona: zapis jawny, a szyfrogramy z przeszłości nie dają się odczytać (znacznik zamiast treści).
// Szyfrogram: zenc1:<kid>:<base64(iv12 ‖ tag16 ‖ ct)>; AAD: zielnik|<tabela>.<kolumna>|<zakres wiersza>, gdzie zakres to niezmienny
// klucz wiersza razem z kontem (symptom_log: user_id|day, user_strain: user_id|strain_id, prescriptions: user_id|id, purchases: user_id|id, strain_tests: id),
// więc szyfrogramu nie da się przenieść do innego konta, kolumny ani wiersza (także w obrębie jednego konta). Pusty tekst zostaje ''
// (warunki note <> '' działają bez zmian). Jawny tekst zaczynający się od zenc1: / zplain: dostaje przy zapisie bez klucza prefiks zplain:.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const PREFIX = 'zenc1:';
export const LOCKED_NOTE = '[notatka zaszyfrowana, brak klucza]';
// Jawny tekst, który zaczyna się od zenc1: albo zplain:, dostaje przy zapisie bez klucza prefiks zplain: (zdejmowany przy odczycie),
// żeby nie wyglądał jak szyfrogram. Z kluczem nie jest to potrzebne: wszystko jest szyfrowane.
export const PLAIN = 'zplain:';
export const plainIn = (s) => (s.startsWith(PREFIX) || s.startsWith(PLAIN) ? PLAIN + s : s);
export const plainOut = (s) => (s.startsWith(PLAIN) ? s.slice(PLAIN.length) : s);
// Kolumny objęte szyfrowaniem: tabela, kolumna, klucz główny (kursor skryptu) oraz zakres w AAD: scope(wiersz) w JS i
// scopeSql (to samo jako wyrażenie SQL). Zakres używa tylko pól, które nigdy się nie zmieniają przy edycji wiersza.
// TODO(POM-28): doctor_notes.text czeka na decyzję właściciela o CHECK 1..200 (docs/SZYFROWANIE-NOTATEK.md, „Wyjątek”)
export const COLUMNS = [
  { table: 'symptom_log', col: 'note', pk: ['user_id', 'day'], scope: (r) => `${r.user_id}|${String(r.day).slice(0, 10)}`,
    scopeSql: `user_id::text || '|' || to_char(day, 'YYYY-MM-DD')` },
  { table: 'user_strain', col: 'notes', pk: ['strain_id', 'user_id'], scope: (r) => `${r.user_id}|${r.strain_id}`,
    scopeSql: `user_id::text || '|' || strain_id::text` },
  { table: 'prescriptions', col: 'note', pk: ['id'], scope: (r) => `${r.user_id}|${r.id}`, scopeSql: `user_id::text || '|' || id::text` },
  // strain_tests: user_id może przejść w SET NULL, więc zakresem jest samo id
  { table: 'strain_tests', col: 'note', pk: ['id'], scope: (r) => String(r.id), scopeSql: `id::text` },
  // group_messages (SPO-2): id nigdy się nie zmienia; wiadomość usunięta ma body '' (nie jest szyfrowana ani odczytywana)
  { table: 'group_messages', col: 'body', pk: ['id'], scope: (r) => String(r.id), scopeSql: `id::text` },
  // purchases.batch_note (POM-32): notatka o partii przy zakupie; zakres jak recepty (konto + id zakupu, oba niezmienne)
  { table: 'purchases', col: 'batch_note', pk: ['id'], scope: (r) => `${r.user_id}|${r.id}`, scopeSql: `user_id::text || '|' || id::text` },
  // migawka zgłoszonej wiadomości (dowód dla admina niezależny od późniejszej edycji lub usunięcia przez autora)
  { table: 'reports', col: 'snapshot', pk: ['id'], scope: (r) => String(r.id), scopeSql: `id::text` },
];
// Zakres AAD wiersza (r: pola kolumn z bazy, np. { user_id, day }).
export const rowScope = (table, r) => COLUMNS.find((c) => c.table === table).scope(r);

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
const aad = (table, col, scope) => Buffer.from(`zielnik|${table}.${col}|${scope}`);

// Zapis: z kluczem szyfrogram, bez klucza (funkcja wyłączona) jawny tekst. Zły format klucza => wyjątek
// (zapis jawny po cichu byłby gorszy niż odmowa; panel Gotowość pokazuje wtedy „weak”).
export function encryptField(table, col, scope, text) {
  const s = text == null ? '' : String(text);
  if (!s) return '';
  const { list, error } = keys();
  if (error) throw new Error(error);
  if (!list.length) return plainIn(s);
  const { kid, key } = list[0];
  const iv = randomBytes(IV_LEN);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(aad(table, col, scope));
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

// Odszyfrowanie pola `field` w liście wierszy (scope: zakres AAD jako funkcja wiersza); wiersze bez wartości bez zmian.
export const openRows = (rows, table, col, scope, field = col) => rows.map((r) => (r[field]
  ? { ...r, [field]: decryptField(table, col, scope(r), r[field]) } : r));

// Kopia zapasowa ({ <tabela>: [wiersze] }): odszyfrowuje notatki w miejscu (backup-decrypt --data-key).
// Zwraca liczby: odszyfrowane i nieodczytane (te zostają szyfrogramem).
export function decryptBackupData(data) {
  const out = { decrypted: 0, failed: 0 };
  for (const { table, col, scope } of COLUMNS) {
    for (const r of data[table] || []) {
      if (!isEncrypted(r[col])) { if (r[col]) r[col] = plainOut(r[col]); continue; }
      try { r[col] = decryptStrict(table, col, scope(r), r[col]); out.decrypted++; } catch { out.failed++; }
    }
  }
  return out;
}

// Surowa odwrotność; wyjątek przy złym kluczu, AAD albo uszkodzeniu (używa skrypt przepisujący).
export function decryptStrict(table, col, scope, stored) {
  const rest = stored.slice(PREFIX.length);
  const i = rest.indexOf(':');
  if (i < 1) throw new Error('uszkodzony szyfrogram');
  const k = keys().list.find((x) => x.kid === rest.slice(0, i));
  if (!k) throw new Error('brak klucza o tym identyfikatorze');
  const buf = Buffer.from(rest.slice(i + 1), 'base64');
  if (buf.length < IV_LEN + TAG_LEN) throw new Error('uszkodzony szyfrogram');
  const d = createDecipheriv('aes-256-gcm', k.key, buf.subarray(0, IV_LEN));
  d.setAAD(aad(table, col, scope));
  d.setAuthTag(buf.subarray(IV_LEN, IV_LEN + TAG_LEN));
  return Buffer.concat([d.update(buf.subarray(IV_LEN + TAG_LEN)), d.final()]).toString('utf8');
}

// Odczyt do edycji w UI: { text, locked }. Szyfrogram, którego nie da się odszyfrować (brak klucza, zły AAD, uszkodzenie),
// daje text '' i locked: true (klient nigdy nie dostaje znacznika, więc nie odeśle go przy zapisie) oraz wpis w dzienniku
// błędów bez treści. Tekst bez prefiksu wraca bez zmian (wiersze sprzed włączenia szyfrowania).
export function readNote(table, col, scope, stored) {
  if (stored == null || stored === '') return { text: '', locked: false };
  if (!isEncrypted(stored)) return { text: plainOut(String(stored)), locked: false };
  try {
    return { text: decryptStrict(table, col, scope, stored), locked: false };
  } catch (e) {
    report(table, col, keys().error ? 'zły format klucza' : e.message);
    return { text: '', locked: true };
  }
}

// Odczyt tylko do wyświetlenia (eksport, raport, profil): nieczytelny szyfrogram daje znacznik LOCKED_NOTE.
export function decryptField(table, col, scope, stored) {
  const r = readNote(table, col, scope, stored);
  return r.locked ? LOCKED_NOTE : r.text;
}

// Wiersz z polem notatki gotowy dla klienta, który ją edytuje: { ...r, [field]: tekst albo '', [`${field}Locked`]: true }.
export function openEditable(table, col, scope, r, field = col) {
  const { text, locked } = readNote(table, col, scope, r[field]);
  return { ...r, [field]: text, ...(locked && { [`${field}Locked`]: true }) };
}

// Co zapisać w kolumnie notatki; stored to bieżąca wartość z bazy (null, gdy brak wiersza). Zwraca { value, keep, unavailable }:
// keep = nie ruszaj istniejącej kolumny (w SQL: CASE WHEN keep THEN kolumna ELSE nowa END), value = wartość dla nowego wiersza.
// Zachowujemy ją, gdy: (1) wejście to znacznik LOCKED_NOTE (stary klient odsyła to, co dostał), (2) wejście jest puste, a w bazie
// leży szyfrogram, którego nie da się odczytać (klient dostał '' + flagę, więc puste pole nie znaczy „skasuj”), (3) zły format
// klucza uniemożliwia zaszyfrowanie nowego tekstu (unavailable: reszta wpisu jest zapisywana, a notatka zostaje bez zmian).
export function planNote(table, col, scope, input, stored = null) {
  const text = String(input ?? '');
  const had = stored ?? '';
  if (text === LOCKED_NOTE) return { value: had, keep: true, unavailable: false };
  if (text === '') {
    if (isEncrypted(had) && readNote(table, col, scope, had).locked) return { value: had, keep: true, unavailable: false };
    return { value: '', keep: false, unavailable: false };
  }
  try {
    return { value: encryptField(table, col, scope, text), keep: false, unavailable: false };
  } catch {
    return { value: had, keep: true, unavailable: true };
  }
}

export const NOTE_UNAVAILABLE_MSG = 'Zapis notatki jest chwilowo niedostępny (błąd konfiguracji szyfrowania po stronie serwera). Pozostałe dane zapisano; notatka została bez zmian.';
export const NOTE_UNAVAILABLE_REJECT_MSG = 'Zapis notatki jest chwilowo niedostępny (błąd konfiguracji szyfrowania po stronie serwera). Spróbuj ponownie później.';
