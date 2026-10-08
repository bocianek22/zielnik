// vercel.json: crony zgodne z planem Hobby (najwyżej raz dziennie), kopia codziennie, bez kolizji godzin ani duplikatów.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('kopia bazy chodzi codziennie o 3:00 UTC', () => {
  const c = cfg.crons.find((x) => x.path === '/api/cron/backup');
  assert.equal(c.schedule, '0 3 * * *');
});

test('żaden cron nie jest częstszy niż raz dziennie (Hobby), ścieżki istnieją, godziny dzienne się nie pokrywają', () => {
  const daily = [];
  for (const c of cfg.crons) {
    const [min, hour, dom, mon, dow] = c.schedule.split(' ');
    assert.match(min, /^\d+$/, c.path);
    assert.match(hour, /^\d+$/, `${c.path}: godzina musi być stała`);
    assert.ok(existsSync(new URL(`..${c.path.replace('/api/', '/app/api/')}/route.js`, import.meta.url)), c.path);
    if (dom === '*' && mon === '*' && dow === '*') daily.push(`${hour}:${min}`);
  }
  assert.equal(new Set(daily).size, daily.length, 'dwa dzienne crony o tej samej porze');
  assert.equal(new Set(cfg.crons.map((c) => c.path)).size, cfg.crons.length);
});
