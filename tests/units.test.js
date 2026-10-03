import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unitOf, normUnit, fmtNum, fmtQty, priceUnit, quickValues, suggestForm, sumByUnit, unitGen } from '../lib/units.js';

test('unitOf: susz w gramach, olej i pen w ml', () => {
  assert.equal(unitOf('susz'), 'g');
  assert.equal(unitOf('olej'), 'ml');
  assert.equal(unitOf('pen'), 'ml');
  assert.equal(unitOf(undefined), 'g');
  assert.equal(unitOf(''), 'g');
  assert.equal(normUnit('ml'), 'ml');
  assert.equal(normUnit('kg'), 'g');
});

test('fmtQty: polski przecinek, najwyżej 2 miejsca, jednostka', () => {
  assert.equal(fmtQty(0.5, 'ml'), '0,5 ml');
  assert.equal(fmtQty(12, 'g'), '12 g');
  assert.equal(fmtQty(1.256, 'g'), '1,26 g');
  assert.equal(fmtQty('0.25', 'ml'), '0,25 ml');
  assert.equal(fmtQty(1000.5), '1000,5 g');
  assert.equal(fmtNum(null), '0');
  assert.equal(fmtNum('abc'), '–');
  assert.equal(priceUnit('ml'), 'zł/ml');
  assert.equal(priceUnit('g'), 'zł/g');
  assert.equal(unitGen('ml'), 'mililitrów');
});

test('quickValues: wartości zależne od postaci', () => {
  assert.deepEqual(quickValues('susz').buy, [5, 10, 15]);
  assert.ok(quickValues('olej').buy.includes(30)); // typowa butelka 30 ml
  assert.ok(quickValues('pen').buy.includes(0.9)); // wkład / strzykawka 0,9 ml
  assert.ok(quickValues('pen').use.every((v) => v <= 0.5));
  assert.deepEqual(quickValues('nieznana'), quickValues('susz'));
});

test('suggestForm: „Extractum” podpowiada olej, reszta bez podpowiedzi', () => {
  assert.equal(suggestForm('Extractum Cannabis THC 10'), 'olej');
  assert.equal(suggestForm('  extractum cbd'), 'olej');
  assert.equal(suggestForm('Cannabis extractum normatum THC 25'), 'olej');
  assert.equal(suggestForm('Lemon Skunk'), null);
  assert.equal(suggestForm('Extractumowa'), null);
  assert.equal(suggestForm(''), null);
});

test('sumByUnit: gramy i ml osobno', () => {
  assert.deepEqual(sumByUnit([{ unit: 'g', grams: 1 }, { unit: 'ml', grams: 0.5 }, { unit: 'g', grams: 2 }, { grams: 1 }]), { g: 4, ml: 0.5 });
  assert.deepEqual(sumByUnit([]), { g: 0, ml: 0 });
});
