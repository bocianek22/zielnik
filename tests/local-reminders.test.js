// POM-49: harmonogram lokalnych przypomnień (lib/local-reminders.js): `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { planLocal, warsawAt, parseLocalSettings, ALL_IDS, ID_BASE, DAYS_AHEAD } from '../lib/local-reminders.js';

test('warsawAt: godzina w czasie polskim, także przy zmianie czasu', () => {
  assert.equal(warsawAt('2026-10-14', 21).toISOString(), '2026-10-14T19:00:00.000Z'); // CEST
  assert.equal(warsawAt('2026-12-01', 21).toISOString(), '2026-12-01T20:00:00.000Z'); // CET
  assert.equal(warsawAt('2026-10-25', 21).toISOString(), '2026-10-25T20:00:00.000Z'); // dzień zmiany na zimowy
  assert.equal(warsawAt('2026-03-29', 19).toISOString(), '2026-03-29T17:00:00.000Z'); // dzień zmiany na letni
});

test('planLocal: wieczory na tydzień, bez dzisiejszego przy wpisie, tylko przyszłość, neutralna treść', () => {
  const now = new Date('2026-10-14T10:00:00Z');
  const all = planLocal({ now, settings: { symptoms: true, hour: 20 } });
  assert.equal(all.length, DAYS_AHEAD + 1);
  assert.equal(all[0].at.toISOString(), '2026-10-14T18:00:00.000Z');
  assert.equal(all[0].id, ID_BASE.symptoms);
  assert.ok(all.every((n) => ALL_IDS.includes(n.id) && !/objaw|konop|odmian|lek/i.test(n.body + n.title)));
  const done = planLocal({ now, settings: { symptoms: true, hour: 20 }, hasToday: true });
  assert.equal(done.length, DAYS_AHEAD);
  assert.equal(done[0].at.toISOString(), '2026-10-15T18:00:00.000Z');
  // po godzinie przypomnienia dziś: dzisiejszego już nie ma
  assert.equal(planLocal({ now: new Date('2026-10-14T19:30:00Z'), settings: { symptoms: true, hour: 20 } })[0].at.toISOString(), '2026-10-15T18:00:00.000Z');
  assert.deepEqual(planLocal({ now, settings: {} }), [], 'domyślnie wyłączone');
});

test('planLocal: wizyta dzień wcześniej o 18:00, tylko w przyszłości', () => {
  const now = new Date('2026-10-14T10:00:00Z');
  const [v] = planLocal({ now, settings: { visit: true }, nextVisit: '2026-10-20' });
  assert.equal(v.id, ID_BASE.visit);
  assert.equal(v.at.toISOString(), '2026-10-19T16:00:00.000Z');
  assert.equal(v.url, '/raport');
  assert.deepEqual(planLocal({ now, settings: { visit: true }, nextVisit: '2026-10-14' }), []);
  assert.deepEqual(planLocal({ now, settings: { visit: true }, nextVisit: 'x' }), []);
});

test('parseLocalSettings: domyślnie wszystko wyłączone, złe dane bezpiecznie', () => {
  assert.deepEqual(parseLocalSettings(null), { symptoms: false, hour: 21, visit: false, rx: false, stock: false });
  assert.deepEqual(parseLocalSettings('{"symptoms":true,"hour":19,"rx":true}'), { symptoms: true, hour: 19, visit: false, rx: true, stock: false });
  assert.deepEqual(parseLocalSettings('{"hour":3,"visit":"tak"}'), { symptoms: false, hour: 21, visit: false, rx: false, stock: false });
  assert.deepEqual(parseLocalSettings('nie json'), { symptoms: false, hour: 21, visit: false, rx: false, stock: false });
});

test('planLocal: recepta 3 dni przed końcem ważności, zapas 2 dni przed końcem prognozy, neutralna treść', () => {
  const now = new Date('2026-10-14T10:00:00Z');
  const [rx] = planLocal({ now, settings: { rx: true }, rxUntil: '2026-10-30' });
  assert.equal(rx.id, ID_BASE.rx);
  assert.equal(rx.at.toISOString(), '2026-10-27T17:00:00.000Z'); // 18:00 CET (po zmianie czasu)
  assert.equal(rx.url, '/recepty');
  assert.deepEqual(planLocal({ now, settings: { rx: true }, rxUntil: '2026-10-15' }), [], 'termin przypomnienia już minął');
  const [st] = planLocal({ now, settings: { stock: true }, stockDays: 6 });
  assert.equal(st.id, ID_BASE.stock);
  assert.equal(st.at.toISOString(), '2026-10-18T16:00:00.000Z');
  assert.deepEqual(planLocal({ now, settings: { stock: true }, stockDays: 1 }), []);
  assert.deepEqual(planLocal({ now, settings: { stock: true }, stockDays: null }), []);
  assert.deepEqual(planLocal({ now, settings: {}, rxUntil: '2026-10-30', stockDays: 6 }), [], 'domyślnie wyłączone');
  for (const n of [rx, st]) assert.doesNotMatch(n.body + n.title, /recept|zapas|konop|odmian|gram|apte/i);
  assert.ok(ALL_IDS.includes(ID_BASE.rx) && ALL_IDS.includes(ID_BASE.stock));
});
