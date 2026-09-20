// Testy funkcji czystych: uruchom `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { strainTags, TAG_THRESHOLD, EFFECT_TAGS } from '../lib/effects.js';
import { parseCsv, csvToObjects } from '../lib/csv.js';
import { expiryInfo } from '../lib/expiry.js';
import { canUse } from '../lib/plans.js';
import { VIS_VALUES, visLabel } from '../lib/visibility.js';
import { FORM_VALUES } from '../lib/forms.js';

const entry = (effects) => ({ effects });

test('tagi efektów: średnia widocznych ocen >= próg tworzy tag', () => {
  const s = { entries: [entry({ relax: 8, energy: 2 }), entry({ relax: 7 })] };
  assert.deepEqual(strainTags(s), [EFFECT_TAGS.relax]);
});

test('tagi efektów: poniżej progu i puste oceny nie tworzą tagu', () => {
  assert.equal(TAG_THRESHOLD, 6.5);
  assert.deepEqual(strainTags({ entries: [entry({ sleep: 6 }), entry({})] }), []);
  assert.deepEqual(strainTags({ entries: [] }), []);
  assert.deepEqual(strainTags({}), []);
});

test('tagi efektów: wiele tagów naraz', () => {
  const s = { entries: [entry({ sleep: 9, pain: 7, relax: 6.5 })] };
  assert.deepEqual(strainTags(s).sort(), ['na ból', 'na sen', 'relaks']);
});

test('CSV: separator średnik, cudzysłowy, BOM i nowa linia w polu', () => {
  const t = '\uFEFFOdmiana;Uwagi\r\nAmnesia;"ładna; z ""cytryną"""\r\nKush;"a\nb"\r\n';
  assert.deepEqual(parseCsv(t), [['Odmiana', 'Uwagi'], ['Amnesia', 'ładna; z "cytryną"'], ['Kush', 'a\nb']]);
});

test('CSV: separator przecinek i konwersja do obiektów', () => {
  assert.deepEqual(csvToObjects('Producent,Odmiana\nAurora,Sourdough\n'), [{ Producent: 'Aurora', Odmiana: 'Sourdough' }]);
  assert.deepEqual(csvToObjects('tylko nagłówek\n'), []);
});

test('ważność: brak daty, przeterminowane, wkrótce, odległa', () => {
  const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  assert.equal(expiryInfo(null), null);
  assert.equal(expiryInfo(day(-3)).expired, true);
  assert.equal(expiryInfo(day(10)).soon, true);
  const far = expiryInfo(day(200));
  assert.equal(far.soon, false);
  assert.equal(far.expired, false);
});

test('plany: bez PREMIUM_ENFORCED wszystko darmowe', () => {
  delete process.env.PREMIUM_ENFORCED;
  assert.equal(canUse({ plan: 'free' }, 'doctor_report'), true);
});

test('plany: z PREMIUM_ENFORCED tylko aktywne Premium', () => {
  process.env.PREMIUM_ENFORCED = '1';
  const future = new Date(Date.now() + 864e5).toISOString();
  const past = new Date(Date.now() - 864e5).toISOString();
  assert.equal(canUse({ plan: 'free' }, 'doctor_report'), false);
  assert.equal(canUse({ plan: 'premium', plan_until: null }, 'doctor_report'), true);
  assert.equal(canUse({ plan: 'premium', plan_until: future }, 'doctor_report'), true);
  assert.equal(canUse({ plan: 'premium', plan_until: past }, 'doctor_report'), false);
  assert.equal(canUse({ plan: 'free' }, 'funkcja_darmowa_nieistniejaca'), true);
  delete process.env.PREMIUM_ENFORCED;
});

test('widoczność i postać: dozwolone wartości', () => {
  assert.deepEqual(VIS_VALUES, ['me', 'friends', 'fof', 'all']);
  assert.equal(visLabel('me'), 'Tylko ja');
  assert.deepEqual(FORM_VALUES, ['susz', 'olej', 'pen']);
});
