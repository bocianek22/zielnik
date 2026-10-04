// Alias sterownika Neon -> pg (scripts/dev/build-local.sh) działa tylko z ZIELNIK_LOCAL_PG=1; produkcyjny build go nie ma.
import test from 'node:test';
import assert from 'node:assert/strict';

const load = async (flag) => {
  const old = process.env.ZIELNIK_LOCAL_PG;
  if (flag === undefined) delete process.env.ZIELNIK_LOCAL_PG; else process.env.ZIELNIK_LOCAL_PG = flag;
  try { return (await import(`../next.config.mjs?flag=${flag}`)).default; }
  finally { if (old === undefined) delete process.env.ZIELNIK_LOCAL_PG; else process.env.ZIELNIK_LOCAL_PG = old; }
};

test('next.config: bez ZIELNIK_LOCAL_PG nie ma webpacka ani aliasu', async () => {
  const cfg = await load(undefined);
  assert.equal(cfg.webpack, undefined);
  assert.equal((await load('0')).webpack, undefined);
  assert.equal(typeof cfg.headers, 'function');
});

test('next.config: z ZIELNIK_LOCAL_PG=1 alias wskazuje na neon-shim', async () => {
  const cfg = await load('1');
  const out = cfg.webpack({ resolve: { alias: {} } });
  assert.match(out.resolve.alias['@neondatabase/serverless'], /tests\/db\/neon-shim\.mjs$/);
});
