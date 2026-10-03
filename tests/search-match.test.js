// Dopasowanie i ranking podpowiedzi wyszukiwania
import test from 'node:test';
import assert from 'node:assert/strict';
import { fold, score, highlight, rank, matches, pushRecent } from '../lib/searchMatch.js';

test('fold: bez wielkości liter i polskich znaków, także ł', () => {
  assert.equal(fold('Żółw Ninja'), 'zolw ninja');
  assert.equal(fold('ŁÓDZKIE Zioła'), 'lodzkie ziola');
  assert.equal(fold('ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ'), 'acelnoszz acelnoszz');
  assert.equal(fold(null), '');
});

test('score: „zolw” pasuje do „Żółw”, brak dopasowania to null', () => {
  assert.equal(score('Żółw Ninja', 'zolw'), 1);
  assert.equal(score('Żółw Ninja', 'ŻÓŁW'), 1);
  assert.equal(score('Łódzkie Zioła', 'ziola'), 2);
  assert.equal(score('Lemon Skunk', 'xyz'), null);
  assert.equal(score('Lemon Skunk', ''), null);
});

test('score: cały tekst < początek < początek słowa < środek słowa', () => {
  assert.equal(score('Kush', 'kush'), 0);
  assert.equal(score('Kush Mints', 'ku'), 1);
  assert.equal(score('Pink Kush', 'ku'), 2);
  assert.equal(score('Pink-Kush', 'ku'), 2);
  assert.equal(score('Skunk', 'ku'), 3);
  // kilka słów: każde musi pasować, liczy się najsłabsze
  assert.equal(score('Ghost Train Haze', 'ha gho'), 2);
  assert.equal(score('Ghost Train Haze', 'haze xyz'), null);
});

test('highlight: wyróżnia fragment w oryginalnym zapisie z polskimi znakami', () => {
  assert.deepEqual(highlight('Żółw Ninja', 'zol'), [{ text: 'Żół', hit: true }, { text: 'w Ninja', hit: false }]);
  assert.deepEqual(highlight('Łódzkie Zioła', 'ziola'), [{ text: 'Łódzkie ', hit: false }, { text: 'Zioła', hit: true }]);
  // pierwszeństwo ma początek słowa, nie pierwsze wystąpienie
  assert.deepEqual(highlight('Skunk Kush', 'ku'), [{ text: 'Skunk ', hit: false }, { text: 'Ku', hit: true }, { text: 'sh', hit: false }]);
  assert.deepEqual(highlight('Abc', ''), [{ text: 'Abc', hit: false }]);
  assert.deepEqual(highlight('Abc', 'x'), [{ text: 'Abc', hit: false }]);
});

const it = (label, extra) => ({ label, extra });

test('rank: kolejność według jakości, remis krótsza etykieta, potem alfabet', () => {
  const r = rank([{ key: 's', items: [it('Skunk'), it('Pink Kush'), it('Kush Mints'), it('Kush'), it('Kosmos')] }], 'ku');
  assert.deepEqual(r[0].items.map((x) => x.label), ['Kush', 'Kush Mints', 'Pink Kush', 'Skunk']);
  const t = rank([{ key: 's', items: [it('Bb'), it('Ab'), it('Ć')] }], 'b');
  assert.deepEqual(t[0].items.map((x) => x.label), ['Bb', 'Ab']);
});

test('rank: pole dodatkowe (producent) ustępuje dopasowaniu nazwy', () => {
  const r = rank([{ key: 's', items: [it('Master Kush', ['Aurora']), it('Aura', ['Tilray'])] }], 'au');
  assert.deepEqual(r[0].items.map((x) => x.label), ['Aura', 'Master Kush']);
});

test('rank: limit łączny i na grupę, puste grupy znikają, kolejność grup zostaje', () => {
  const many = (p, n) => Array.from({ length: n }, (_, i) => it(`${p}${i}`));
  const r = rank([
    { key: 'a', items: many('z', 10) },
    { key: 'b', items: [it('nic')] },
    { key: 'c', items: many('zz', 10) },
  ], 'z', { max: 8, perGroup: 5 });
  assert.deepEqual(r.map((g) => g.key), ['a', 'c']);
  assert.equal(r[0].items.length, 5);
  assert.equal(r[1].items.length, 3);
  assert.equal(rank([{ key: 'a', items: many('z', 3) }], '').length, 0);
});

test('matches: filtr „zawiera” bez polskich znaków, wszystkie słowa', () => {
  assert.ok(matches('Żółw Ninja Łódzkie Zioła', 'zolw ziola'));
  assert.ok(matches('Cokolwiek', '  '));
  assert.ok(!matches('Żółw Ninja', 'zolw kush'));
});

test('pushRecent: nowe na początku, bez duplikatów, z limitem', () => {
  assert.deepEqual(pushRecent(['kush', 'Żółw'], 'zolw'), ['zolw', 'kush']);
  assert.deepEqual(pushRecent(['a', 'b'], '  '), ['a', 'b']);
  assert.deepEqual(pushRecent(['a', 'b', 'c'], 'd', 3), ['d', 'a', 'b']);
});
