// Wstrzyknięcie formuł w CSV: GET /api/export neutralizuje pola tekstowe odmian (= + - @, tabulator, CR).
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { setup, skip } from './harness.mjs';

let h;
before(async () => { if (!skip) h = await setup(); });
after(async () => { if (h) await h.pool.end(); });

test('export CSV: nazwa, producent, smak i notatka zaczynające się od = + - @ dostają apostrof', { skip }, async () => {
  const { q, ids, call } = h;
  const evil = ['=HYPERLINK("http://x","k")', '+cmd|calc', '-2+3', '@SUM(A1)'];
  for (const [i, v] of evil.entries()) {
    const [s] = await q`INSERT INTO strains (name, producer, type, form, taste, created_by) VALUES (${v}, ${evil[(i + 1) % 4]}, 'haze', 'susz', ${evil[(i + 2) % 4]}, ${ids.ania}) RETURNING id`;
    await q`INSERT INTO user_strain (user_id, strain_id, notes) VALUES (${ids.ania}, ${s.id}, ${evil[(i + 3) % 4]})`;
  }
  const r = await call(ids.ania, 'export', 'GET');
  assert.equal(r.status, 200);
  const rows = r.text.replace(/^﻿/, '').split('\r\n').slice(1).filter(Boolean);
  assert.equal(rows.length, 4);
  // żadna komórka nie zaczyna się od znaku formuły (po ewentualnym cudzysłowie CSV)
  for (const line of rows) {
    for (const cell of line.match(/"(?:[^"]|"")*"|[^;]+/g)) {
      assert.doesNotMatch(cell.replace(/^"/, ''), /^[=+\-@\t\r]/, `komórka: ${cell}`);
    }
  }
  assert.match(r.text, /"'=HYPERLINK\(""http:\/\/x"",""k""\)"/);
  assert.match(r.text, /'\+cmd\|calc/);
  assert.match(r.text, /'-2\+3/);
  assert.match(r.text, /'@SUM\(A1\)/);
});

test('export CSV: zwykłe wartości i liczby bez zmian', { skip }, async () => {
  const { q, ids, call } = h;
  await q`DELETE FROM strains`;
  const [s] = await q`INSERT INTO strains (name, producer, type, form, thc, created_by) VALUES ('Haze', 'Prod', 'haze', 'susz', 22.5, ${ids.ania}) RETURNING id`;
  await q`INSERT INTO user_strain (user_id, strain_id, rating) VALUES (${ids.ania}, ${s.id}, 8)`;
  const r = await call(ids.ania, 'export', 'GET');
  assert.match(r.text, /\r\nHaze;Prod;[^;]*;haze;22\.5/);
});
