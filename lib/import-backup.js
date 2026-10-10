// POM-41: Import kopii (plik JSON z /api/account/export) na własne konto. Ten moduł jest czysty (bez bazy): sprawdza i
// normalizuje zawartość pliku. Plik jest NIEUFNY: z niego bierzemy wyłącznie wartości, nigdy identyfikatorów do wstawienia
// (stare id służą tylko do mapowania w pamięci, np. recepta zakupu), a limity są takie same jak w trasach zapisu.
// Zapis do bazy: lib/import-backup-db.js.
import { LOCKED_NOTE, PREFIX } from './data-crypto.js';
import { EFFECTS } from './effects.js';
import { METHODS, PERIODS, parseChoice } from './usage-meta.js';
import { CUSTOM_MAX, cleanCustomName } from './symptoms.js';
import { normUnit } from './units.js';
import { BATCH_EFFECTS, BATCH_NO_MAX, BATCH_NOTE_MAX } from './batch-meta.js';

export const MAX_BODY = 4 * 1024 * 1024; // Vercel przyjmuje najwyżej 4,5 MB treści żądania
// górne granice liczby wierszy w sekcji (nadmiar jest pomijany i zgłaszany jako „limit”)
export const CAPS = { entries: 5000, pool: 5000, usage: 20000, purchases: 10000, tests: 5000, prescriptions: 500, symptoms: 5000, customValues: 15000, doctorNotes: 500, noUse: 5000 };
const MAX_TESTS_PER_STRAIN = 50; // jak w trasie nowego testu
export const NOTES_MAX = 10, NOTE_LEN = 200; // jak w lib/doctor-notes.js (tamten moduł wymaga bazy, a ten ma zostać czysty)
const MIN_MS = Date.UTC(2000, 0, 1);
const DAY_MS = 864e5;
const SYMPTOMS_HOURS = [19, 20, 21, 22]; // jak w lib/push.js

const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const str = (v, max) => (typeof v === 'string' ? v.trim() : null)?.slice(0, max) ?? null;

// jak parseNumber w lib/strains.js: null = pusto, NaN = błąd; liczby tylko jako number albo napis liczbowy
export function num(v, min, max) {
  if (v === '' || v == null) return null;
  if (typeof v !== 'number' && typeof v !== 'string') return NaN;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return NaN;
  return Math.round(n * 100) / 100;
}

// Dzień RRRR-MM-DD (z kalendarza: 2021-02-30 odpada), od 2000 do `maxMs`
export function day(v, maxMs) {
  // pliki sprzed poprawki eksportu miały daty recept jako północ UTC w formacie ISO
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/.test(v)) v = v.slice(0, 10);
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const t = Date.parse(`${v}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== v || t < MIN_MS || t > maxMs) return null;
  return v;
}

// Moment (ISO) od 2000 do jutra; zwraca ISO z milisekundami albo null
export function stamp(v, now) {
  if (typeof v !== 'string' || v.length > 40) return null;
  const t = Date.parse(v);
  if (Number.isNaN(t) || t < MIN_MS || t > now + DAY_MS) return null;
  return new Date(t).toISOString();
}

// Notatka z pliku: znacznik nieczytelnej notatki i szyfrogram (zenc1:) nie są treścią. Zwraca { text, dropped }.
export function noteText(v, max) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s === LOCKED_NOTE || s.startsWith(PREFIX)) return { text: '', dropped: true };
  return { text: s.slice(0, max), dropped: false };
}

// Zwraca { error } albo { s, invalid, limit, droppedNotes, photos, ignored }
export function normalizeBackup(data, now = Date.now()) {
  const d = obj(data);
  if (!d || typeof d.exportedAt !== 'string' || !['entries', 'usage', 'purchases', 'symptoms', 'prescriptions', 'tests', 'doctorNotes'].some((k) => Array.isArray(d[k]))) {
    return { error: 'To nie jest plik eksportu danych (Profil, „Pobierz dane (JSON)”).' };
  }
  const invalid = {}, limit = {};
  let droppedNotes = 0, photos = 0;
  const bad = (k) => { invalid[k] = (invalid[k] || 0) + 1; };
  // sekcja: pierwsze CAPS[k] wierszy, reszta liczy się jako „limit”
  const rows = (k, v, cap = CAPS[k]) => { const a = arr(v); if (a.length > cap) limit[k] = a.length - cap; return a.slice(0, cap); };
  const note = (v, max) => { const r = noteText(v, max); if (r.dropped) droppedNotes++; return r.text; };
  const pastDay = (v) => day(v, now + DAY_MS);
  const s = {};

  s.entries = [];
  for (const r of rows('entries', d.entries)) {
    const e = obj(r), name = str(e?.strain, 200), producer = str(e?.producer, 200);
    if (!name || !producer) { bad('entries'); continue; }
    const rating = num(e.rating, 0, 10), cur = num(e.current_g, 0, 100000), price = num(e.price_per_g, 0, 10000);
    const effects = {};
    for (const [key] of EFFECTS) { const v = num(obj(e.effects)?.[key], 0, 10); if (v != null && !Number.isNaN(v)) effects[key] = v; }
    s.entries.push({ name, producer, rating: Number.isNaN(rating) ? null : rating, ratedAt: stamp(e.rated_at, now), current: Number.isNaN(cur) ? 0 : cur ?? 0,
      price: Number.isNaN(price) ? null : price, effects, notes: note(e.notes, 1000) });
  }

  // pozycje „do wykupienia”: klucz puli zostaje tekstem; do bazy trafia tylko, jeśli równa się kluczowi puli odmiany z katalogu
  s.pool = [];
  for (const r of rows('pool', d.remainingToBuy)) {
    const key = str(obj(r)?.pool_key, 200), g = num(r?.grams, 0, 100000);
    if (g === 0) continue; // po wykupie zostaje 0: nic do przeniesienia, to nie błąd
    if (!key || g == null || Number.isNaN(g) || g < 0) { bad('pool'); continue; }
    s.pool.push({ key, grams: g });
  }

  // ilości z jednostką: niezgodna z postacią odmiany jest sprawdzana w bazie (inna odmiana o tej samej nazwie)
  const strainRef = (e) => ({ name: str(e?.strain, 200), producer: str(e?.producer, 200) || null, unit: e?.unit === 'ml' || e?.unit === 'g' ? e.unit : null });

  s.usage = [];
  for (const r of rows('usage', d.usage)) {
    const e = obj(r), ref = strainRef(e), g = num(e?.grams, 0.01, 1000), at = stamp(e?.created_at, now);
    const method = parseChoice(e?.method ?? null, METHODS), period = parseChoice(e?.period ?? null, PERIODS);
    if (!ref.name || g == null || Number.isNaN(g) || !at) { bad('usage'); continue; }
    s.usage.push({ ...ref, grams: g, at, method: method || null, period: period || null });
  }

  s.purchases = [];
  for (const r of rows('purchases', d.purchases)) {
    const e = obj(r), ref = strainRef(e), g = num(e?.grams, 0.01, 100000), at = stamp(e?.created_at, now), cost = num(e?.cost, 0, 1000000);
    if (!ref.name || g == null || Number.isNaN(g) || !at) { bad('purchases'); continue; }
    // partia (POM-32): numer, ważność, ocena (tylko znane wartości) i notatka; błędne pole partii jest pomijane, zakup zostaje
    const batchNo = str(e.batchNo, BATCH_NO_MAX)?.replace(/[\u0000-\u001f\u007f]/g, '') ?? '';
    const batchEffect = typeof e.batchEffect === 'string' && Object.hasOwn(BATCH_EFFECTS, e.batchEffect) ? e.batchEffect : null;
    s.purchases.push({ ...ref, grams: g, at, cost: Number.isNaN(cost) ? null : cost, noRx: e.noRx === true,
      batchNo, batchExpires: day(e.batchExpires, Date.UTC(2100, 11, 31)), batchEffect, batchNote: note(e.batchNote, BATCH_NOTE_MAX),
      // stare id recepty to tylko klucz do mapowania w pamięci (nowe id nadaje baza)
      oldRx: Number.isInteger(e.prescriptionId) && e.prescriptionId > 0 ? e.prescriptionId : null });
  }

  s.tests = [];
  const perStrain = new Map();
  for (const r of rows('tests', d.tests)) {
    const e = obj(r), ref = strainRef(e), at = stamp(e?.created_at, now);
    const hasPhoto = !!(e?.has_photo || e?.photo_base64 || e?.mime);
    if (hasPhoto) photos++;
    const text = note(e?.note, 1500);
    if (!ref.name || !at || !text) { bad('tests'); continue; } // test bez opisu miał tylko zdjęcie, którego nie przenosimy
    const k = `${ref.name.toLowerCase()}|${ref.producer?.toLowerCase() ?? ''}`;
    if ((perStrain.get(k) || 0) >= MAX_TESTS_PER_STRAIN) { limit.tests = (limit.tests || 0) + 1; continue; }
    perStrain.set(k, (perStrain.get(k) || 0) + 1);
    s.tests.push({ ...ref, note: text, at });
  }
  photos += arr(d.strainPhotosAdded).filter((p) => p?.photo_base64 || p?.blob_path || p?.has_photo).length + (d.avatar ? 1 : 0);

  s.prescriptions = [];
  for (const r of rows('prescriptions', d.prescriptions)) {
    const e = obj(r), issued = day(e?.issued_on, Date.UTC(2100, 0, 1)), valid = e?.valid_until == null ? null : day(e.valid_until, Date.UTC(2100, 0, 1));
    const g = num(e?.grams, 0.1, 100000);
    if (!issued || (e.valid_until != null && (!valid || valid < issued)) || g == null || Number.isNaN(g)) { bad('prescriptions'); continue; }
    s.prescriptions.push({ oldId: Number.isInteger(e.id) && e.id > 0 ? e.id : null, issued, valid, grams: g, unit: normUnit(e.unit), note: note(e.note, 120) });
  }

  s.symptoms = [];
  for (const r of rows('symptoms', d.symptoms)) {
    const e = obj(r), dy = pastDay(e?.day), v = {};
    let ok = !!dy;
    for (const f of ['pain', 'sleep', 'anxiety', 'mood']) {
      const n = num(e?.[f], 0, 10);
      if (Number.isNaN(n)) ok = false; else v[f] = n == null ? null : Math.round(n);
    }
    if (!ok) { bad('symptoms'); continue; }
    s.symptoms.push({ day: dy, ...v, note: note(e.note, 500) });
  }

  // własne objawy: najwyżej CUSTOM_MAX nazw (kolejność z pliku), wartości tylko dla nich
  s.custom = [];
  for (const r of arr(d.customSymptoms)) {
    const name = cleanCustomName(obj(r)?.name);
    if (!name) { bad('custom'); continue; }
    if (s.custom.some((c) => c.name.toLowerCase() === name.toLowerCase())) continue;
    if (s.custom.length >= CUSTOM_MAX) { limit.custom = (limit.custom || 0) + 1; continue; }
    s.custom.push({ name, higherBetter: r.higherBetter === true });
  }
  s.customValues = [];
  for (const r of rows('customValues', d.customSymptomValues)) {
    const e = obj(r), dy = pastDay(e?.day), name = cleanCustomName(e?.symptom), n = num(e?.value, 0, 10);
    if (!dy || !name || n == null || Number.isNaN(n)) { bad('customValues'); continue; }
    s.customValues.push({ day: dy, name, value: Math.round(n) });
  }

  s.doctorNotes = [];
  for (const r of rows('doctorNotes', d.doctorNotes)) {
    const e = obj(r);
    const text = typeof e?.text === 'string' ? e.text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const at = stamp(e?.createdAt, now);
    if (!text || text.length > NOTE_LEN || !at) { bad('doctorNotes'); continue; }
    s.doctorNotes.push({ text, done: e.done === true, at, doneAt: e.done === true ? stamp(e.doneAt, now) : null });
  }

  s.noUse = [];
  for (const v of rows('noUse', d.noUseDays)) {
    const dy = pastDay(v);
    if (dy) s.noUse.push(dy); else bad('noUse');
  }

  // ustawienia przypomnień (bez urządzeń): tylko poprawne wartości, reszta zostaje domyślna
  s.prefs = null;
  const p = obj(d.pushNotifications?.settings);
  if (p) {
    const bool = (v) => (typeof v === 'boolean' ? v : null);
    const int = (v, a, b) => (Number.isInteger(v) && v >= a && v <= b ? v : null);
    const visit = day(p.next_visit_on, Date.UTC(2100, 0, 1));
    s.prefs = {
      rx: bool(p.notify_prescription), stock: bool(p.notify_stock), days: int(p.stock_days, 1, 30), hour: int(p.notify_hour, 0, 23),
      details: bool(p.show_details), sym: bool(p.notify_symptoms), symHour: SYMPTOMS_HOURS.includes(p.symptoms_hour) ? p.symptoms_hour : null,
      visit: bool(p.notify_visit), visitOn: visit && visit >= new Date(now).toISOString().slice(0, 10) ? visit : null,
    };
  }

  // co jest w pliku, a nie jest przenoszone (do podsumowania)
  const ignored = [];
  if (arr(d.friends).length) ignored.push('znajomi');
  if (arr(d.groups).length) ignored.push('grupy');
  if (arr(d.groupMessages).length) ignored.push('wiadomości w czatach grup');
  if (arr(d.blocked).length) ignored.push('blokady');
  if (arr(d.reportsFiled).length || arr(d.feedback).length) ignored.push('zgłoszenia i uwagi');
  if (arr(d.strainEdits).length || arr(d.strainProposals).length || arr(d.strainsCreated).length) ignored.push('zmiany i propozycje w katalogu');
  if (arr(d.sessions).length) ignored.push('zalogowane urządzenia');
  if (d.profile || arr(d.consentLog).length) ignored.push('profil, e-mail i zgody');
  return { s, invalid, limit, droppedNotes, photos, ignored, openMax: NOTES_MAX };
}
