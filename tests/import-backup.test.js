// POM-41: walidacja i normalizacja pliku eksportu przed importem (lib/import-backup.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBackup, day, stamp, noteText, num } from '../lib/import-backup.js';

const NOW = Date.parse('2026-10-09T12:00:00Z');
const base = (x) => ({ exportedAt: '2026-10-09T10:00:00Z', ...x });

test('plik, który nie jest eksportem, jest odrzucany', () => {
  for (const d of [null, [], 'x', 5, {}, { exportedAt: 1, entries: [] }, { exportedAt: 'x' }, { exportedAt: 'x', entries: 'a' }]) assert.ok(normalizeBackup(d, NOW).error, JSON.stringify(d));
  assert.equal(normalizeBackup(base({ entries: [] }), NOW).error, undefined);
});

test('day i stamp: kalendarz, zakres i format', () => {
  assert.equal(day('2026-02-28', NOW), '2026-02-28');
  assert.equal(day('2026-02-30', NOW), null);
  assert.equal(day('1999-12-31', NOW), null);
  assert.equal(day('2026-10-11', NOW + 864e5), null); // dalej niż jutro
  assert.equal(day('2026-10-10', NOW + 864e5), '2026-10-10');
  assert.equal(day('2026-05-01T00:00:00.000Z', NOW), '2026-05-01'); // stary eksport: północ UTC
  assert.equal(day('2026-05-01T12:00:00.000Z', NOW), null);
  assert.equal(day(20260501, NOW), null);
  assert.equal(stamp('2026-09-01T10:00:00.123456Z', NOW), '2026-09-01T10:00:00.123Z');
  assert.equal(stamp('wczoraj', NOW), null);
  assert.equal(stamp('2026-12-01T10:00:00Z', NOW), null);
  assert.equal(stamp('x'.repeat(100), NOW), null);
  assert.equal(stamp({}, NOW), null);
});

test('num jak parseNumber: puste = null, błąd = NaN, zaokrąglenie do 2 miejsc', () => {
  assert.equal(num('', 0, 10), null); assert.equal(num(null, 0, 10), null);
  assert.ok(Number.isNaN(num(11, 0, 10))); assert.ok(Number.isNaN(num('abc', 0, 10))); assert.ok(Number.isNaN(num(true, 0, 10))); assert.ok(Number.isNaN(num({}, 0, 10)));
  assert.equal(num('1.234', 0, 10), 1.23);
});

test('notatka: znacznik i szyfrogram z pliku nie są treścią, reszta jest przycinana', () => {
  assert.deepEqual(noteText('[notatka zaszyfrowana, brak klucza]', 100), { text: '', dropped: true });
  assert.deepEqual(noteText('zenc1:k1:AAAA', 100), { text: '', dropped: true });
  assert.deepEqual(noteText('  abcdef  ', 3), { text: 'abc', dropped: false });
  assert.deepEqual(noteText(5, 3), { text: '', dropped: false });
});

test('normalizeBackup: identyfikatory z pliku nie przechodzą, limity i wartości jak w trasach zapisu', () => {
  const r = normalizeBackup(base({
    entries: [{ strain: 'A', producer: 'P', strain_id: 7, user_id: 3, rating: 99, current_g: 5, visibility: 'all', notes: 'x'.repeat(2000), effects: { relax: 4, evil: 9 } }, { strain: '', producer: 'P' }],
    usage: [{ strain: 'A', grams: 0.5, unit: 'g', created_at: '2026-09-01T10:00:00Z', method: 'zła', id: 5 }, { strain: 'A', grams: 2000, created_at: '2026-09-01T10:00:00Z' }],
    purchases: [{ strain: 'A', grams: 5, created_at: '2026-09-01T10:00:00Z', prescriptionId: 12, user_id: 9 }],
    tests: [{ strain: 'A', note: 'n', created_at: '2026-09-01T10:00:00Z', has_photo: true }, { strain: 'A', note: '', created_at: '2026-09-01T10:00:00Z', has_photo: true }],
    remainingToBuy: [{ pool_key: 'strain:5', grams: 3 }, { pool_key: 'p|20.0|1.0', grams: 3 }],
    customSymptoms: ['a', 'b', 'c', 'd', 'A'].map((name) => ({ name })),
    symptoms: [{ day: '2026-09-01', pain: 5.4, sleep: null, note: 'x'.repeat(900) }, { day: '2026-09-02', pain: 12 }],
    friends: [{ username: 'x' }], avatar: 'data:...',
  }), NOW);
  assert.equal(r.error, undefined);
  const e = r.s.entries[0];
  assert.deepEqual(Object.keys(e).sort(), ['current', 'effects', 'name', 'notes', 'price', 'producer', 'rating', 'ratedAt'].sort());
  assert.equal(e.rating, null); assert.equal(e.notes.length, 1000); assert.deepEqual(e.effects, { relax: 4 });
  assert.equal(r.invalid.entries, 1);
  assert.equal(r.s.usage.length, 1); assert.equal(r.s.usage[0].method, null); assert.equal(r.invalid.usage, 1);
  assert.deepEqual(Object.keys(r.s.usage[0]).sort(), ['at', 'grams', 'method', 'name', 'period', 'producer', 'unit'].sort(), 'bez id z pliku');
  assert.equal(r.s.purchases[0].oldRx, 12); assert.ok(!('user_id' in r.s.purchases[0]));
  assert.equal(r.s.tests.length, 1); assert.equal(r.photos, 3); // dwa testy ze zdjęciem + awatar
  assert.deepEqual(r.s.pool.map((p) => p.key), ['p|20.0|1.0']);
  assert.equal(r.s.custom.length, 3); assert.equal(r.limit.custom, 1);
  assert.equal(r.s.symptoms.length, 1); assert.equal(r.s.symptoms[0].pain, 5); assert.equal(r.s.symptoms[0].note.length, 500);
  assert.deepEqual(r.ignored, ['znajomi']);
});

test('normalizeBackup: limit sekcji i testów na odmianę', () => {
  const tests = Array.from({ length: 60 }, (_, i) => ({ strain: 'A', producer: 'P', note: `n${i}`, created_at: '2026-09-01T10:00:00Z' }));
  const r = normalizeBackup(base({ tests, noUseDays: Array.from({ length: 5100 }, (_, i) => new Date(Date.UTC(2020, 0, 1 + (i % 1000))).toISOString().slice(0, 10)) }), NOW);
  assert.equal(r.s.tests.length, 50); assert.equal(r.limit.tests, 10);
  assert.equal(r.s.noUse.length, 5000); assert.equal(r.limit.noUse, 100);
});

test('ustawienia przypomnień: tylko poprawne wartości, wizyta z przeszłości odpada', () => {
  const r = normalizeBackup(base({ entries: [], pushNotifications: { settings: { notify_prescription: false, stock_days: 99, notify_hour: 7, symptoms_hour: 5, next_visit_on: '2026-01-01', notify_symptoms: 'tak' } } }), NOW);
  assert.deepEqual(r.s.prefs, { rx: false, stock: null, days: null, hour: 7, details: null, sym: null, symHour: null, visit: null, visitOn: null });
});
