import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNum } from '../app/components/num.js';

test('parseNum: przecinek i kropka', () => {
  assert.equal(parseNum('0,5'), 0.5);
  assert.equal(parseNum('1.5'), 1.5);
  assert.equal(parseNum(' 12,25 '), 12.25);
  assert.equal(parseNum(',5'), 0.5);
  assert.equal(parseNum('10'), 10);
  assert.equal(parseNum('10,'), 10);
  assert.equal(parseNum(0), 0);
  assert.equal(parseNum('0'), 0);
});

test('parseNum: puste i błędne', () => {
  assert.equal(parseNum(''), null);
  assert.equal(parseNum('  '), null);
  assert.equal(parseNum(null), null);
  assert.equal(parseNum(undefined), null);
  assert.ok(Number.isNaN(parseNum('abc')));
  assert.ok(Number.isNaN(parseNum('1,2,3')));
  assert.ok(Number.isNaN(parseNum('-1')));
  assert.ok(Number.isNaN(parseNum('1e3')));
  assert.ok(Number.isNaN(parseNum(',')));
});
