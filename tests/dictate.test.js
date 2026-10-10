// Dyktowanie notatek (POM-43): sklejanie tekstu, składanie transkryptu i komunikaty błędów
import test from 'node:test';
import assert from 'node:assert/strict';
import { joinDictation, transcriptOf, dictateError, DICTATE_NOTICE } from '../lib/dictate.js';

test('joinDictation: dopisuje po spacji, bez podwójnych spacji i bez zmian przy pustym dyktacie', () => {
  assert.equal(joinDictation('', 'boli głowa'), 'boli głowa');
  assert.equal(joinDictation('Rano', 'boli głowa'), 'Rano boli głowa');
  assert.equal(joinDictation('Rano ', 'boli głowa'), 'Rano boli głowa');
  assert.equal(joinDictation('Rano\n', 'boli głowa'), 'Rano\nboli głowa');
  assert.equal(joinDictation('Rano', '  boli   głowa \n'), 'Rano boli głowa');
  assert.equal(joinDictation('Rano', ''), 'Rano');
  assert.equal(joinDictation('Rano', '   '), 'Rano');
  assert.equal(joinDictation(undefined, 'a'), 'a');
});

test('joinDictation: przycina do limitu pola bez końcowej spacji', () => {
  assert.equal(joinDictation('abc', 'def ghi', 7), 'abc def');
  assert.equal(joinDictation('abc', 'def ghi', 8), 'abc def');
  assert.equal(joinDictation('abcdef', 'x', 3), 'abc');
  assert.ok(joinDictation('x'.repeat(10), 'y'.repeat(600), 500).length <= 500);
});

test('transcriptOf: skleja wyniki sesji i wie, czy wszystkie są ostateczne', () => {
  const r = (t, isFinal) => Object.assign([{ transcript: t }], { isFinal });
  assert.deepEqual(transcriptOf([r('mam ', true), r('ból głowy', false)]), { text: 'mam ból głowy', final: false });
  assert.deepEqual(transcriptOf([r('mam ból', true)]), { text: 'mam ból', final: true });
  assert.deepEqual(transcriptOf([]), { text: '', final: true });
  assert.deepEqual(transcriptOf(undefined), { text: '', final: true });
});

test('dictateError: komunikaty po polsku, przerwanie bez komunikatu', () => {
  assert.match(dictateError('not-allowed'), /mikrofon/i);
  assert.equal(dictateError('service-not-allowed'), dictateError('not-allowed'));
  assert.match(dictateError('audio-capture'), /mikrofonu/);
  assert.match(dictateError('no-speech'), /mowy/);
  assert.match(dictateError('network'), /internet/);
  assert.equal(dictateError('aborted'), null);
  assert.ok(dictateError('coś-nowego'));
});

test('informacja o prywatności: przeglądarka robi rozpoznawanie, Zielnik nic nie wysyła', () => {
  assert.match(DICTATE_NOTICE, /Google/);
  assert.match(DICTATE_NOTICE, /Apple/);
  assert.match(DICTATE_NOTICE, /Zielnik nie wysyła nagrania/);
});
