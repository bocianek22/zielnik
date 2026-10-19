// Plan wykupu (lib/refill-plan.js): `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { todayRefills, refillPlan, LEAD_DAYS } from '../lib/refill-plan.js';

const T = '2026-10-18';
const rx = (o) => ({ unit: 'g', remaining: 10, valid_until: '2026-12-01', days_left: 44, ...o });

test('bez tempa albo zapasu nie ma planu', () => {
  assert.equal(refillPlan({ unit: 'g', stock: 5, perDay: 0, today: T }), null);
  assert.equal(refillPlan({ unit: 'g', stock: NaN, perDay: 1, today: T }), null);
});

test('jest ważna recepta: wykup LEAD_DAYS dni przed końcem zapasu', () => {
  const p = refillPlan({ unit: 'g', stock: 10, perDay: 0.5, rx: [rx()], today: T });
  assert.equal(p.daysLeft, 20); assert.equal(p.runOut, '2026-11-07');
  assert.equal(p.buyBy, '2026-11-02'); assert.equal(p.daysToBuy, 20 - LEAD_DAYS);
  assert.equal(p.status, 'ok'); assert.equal(p.due, false);
  assert.deepEqual(p.rx, { remaining: 10, validUntil: '2026-12-01' });
});

test('mało zapasu: wykup dziś, plan pilny', () => {
  const p = refillPlan({ unit: 'g', stock: 1, perDay: 0.5, rx: [rx()], today: T });
  assert.equal(p.buyBy, T); assert.equal(p.daysToBuy, 0); assert.equal(p.due, true);
});

test('recepta wygasa przed czasem wykupu: kupić przed jej końcem', () => {
  const p = refillPlan({ unit: 'g', stock: 15, perDay: 0.5, rx: [rx({ valid_until: '2026-10-25', days_left: 7 })], today: T });
  assert.equal(p.status, 'rx-first'); assert.equal(p.buyBy, '2026-10-25'); assert.equal(p.daysToBuy, 7); assert.equal(p.due, false);
});

test('brak ważnej recepty: potrzebna nowa; pilne, gdy zapasu na ≤ 21 dni', () => {
  const expired = rx({ valid_until: '2026-10-10', days_left: -8 });
  const used = rx({ remaining: 0 });
  const ml = rx({ unit: 'ml' });
  let p = refillPlan({ unit: 'g', stock: 5, perDay: 0.5, rx: [expired, used, ml], today: T });
  assert.equal(p.status, 'need-rx'); assert.equal(p.rx, null); assert.equal(p.due, true);
  p = refillPlan({ unit: 'g', stock: 50, perDay: 0.5, rx: [], today: T });
  assert.equal(p.due, false, 'zapasu na 100 dni: jeszcze bez alarmu');
});

test('najbliżej wygasająca ważna recepta tej jednostki', () => {
  const p = refillPlan({ unit: 'ml', stock: 20, perDay: 1, today: T,
    rx: [rx({ unit: 'ml', valid_until: '2026-12-20', days_left: 63, remaining: 30 }), rx({ unit: 'ml', valid_until: '2026-11-30', days_left: 43, remaining: 5 })] });
  assert.deepEqual(p.rx, { remaining: 5, validUntil: '2026-11-30' });
});

test('druga recepta pokrywa termin wykupu: bez ostrzeżenia, choć pierwsza wygasa wcześniej', () => {
  const p = refillPlan({ unit: 'g', stock: 10, perDay: 0.5, today: T,
    rx: [rx({ valid_until: '2026-10-20', days_left: 2, remaining: 5 }), rx({ valid_until: '2027-01-01', days_left: 75, remaining: 30 })] });
  assert.equal(p.status, 'ok'); assert.equal(p.buyBy, '2026-11-02'); assert.equal(p.due, false);
  assert.deepEqual(p.rx, { remaining: 30, validUntil: '2027-01-01' });
});

test('pusty zapas bez planu, bardzo wolne tempo bez błędu daty', () => {
  assert.equal(refillPlan({ unit: 'g', stock: 0, perDay: 0.5, today: T }), null);
  assert.equal(refillPlan({ unit: 'g', stock: 10, perDay: 1e-9, today: T }).daysLeft, 3650);
});

test('plan na dziś: wygasła recepta nie ukrywa wykupu, wygasająca tej samej jednostki tak', () => {
  const valid = rx({ valid_until: '2026-10-21', days_left: 3 });
  const expired = rx({ valid_until: '2026-10-15', days_left: -3, remaining: 2 });
  const base = { units: ['g'], stock: { g: 1 }, perDay: { g: 0.5 }, today: T };
  assert.equal(todayRefills({ ...base, rx: [valid], urgentRx: valid }).length, 0, 'dubel z „Recepta wygasa”');
  assert.equal(todayRefills({ ...base, rx: [expired, valid], urgentRx: expired }).length, 1);
  // ostrzeżenie o recepcie na ml nie ukrywa planu dla suszu
  const ml = rx({ unit: 'ml', valid_until: '2026-10-20', days_left: 2 });
  assert.equal(todayRefills({ ...base, rx: [ml], urgentRx: ml })[0].status, 'need-rx');
  // „Kończy się zapas” zastępuje „wykup”, ale nie „potrzebna nowa recepta”
  assert.equal(todayRefills({ ...base, rx: [rx()], lowUnit: 'g' }).length, 0);
  assert.equal(todayRefills({ ...base, rx: [], lowUnit: 'g' })[0].status, 'need-rx');
});
