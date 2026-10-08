// Podpowiedź karty odmiany z internetu (POST /api/strains/suggest) z podmienionym fetch: wynik i „nie znaleziono” w pamięci
// podręcznej (ponowna próba bez kosztu), wznowienie po pause_turn, wymuszona karta po wyszukiwaniu, błąd API.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, auth, uid;
const realFetch = globalThis.fetch;
let calls = [];

// Kolejne odpowiedzi API Anthropic; każde wywołanie zapisuje wysłane ciało
function mock(...replies) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /api\.anthropic\.com/);
    calls.push(JSON.parse(init.body));
    const r = replies.shift();
    return r instanceof Response ? r : new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}
const search = (url) => ({ type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', url, title: 'Źródło' }] });
const usage = (n) => ({ input_tokens: 1000, output_tokens: 100, server_tool_use: { web_search_requests: n } });
const card = (input) => ({ type: 'tool_use', id: 't1', name: 'karta_odmiany', input });

async function suggest(producer, name) {
  jar.clear();
  await auth.createSession(uid);
  const mod = await import('../../app/api/strains/suggest/route.js');
  const res = await mod.POST(new Request('http://localhost/api/strains/suggest', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ producer, name }),
  }));
  return { status: res.status, json: await res.json() };
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  process.env.ANTHROPIC_API_KEY = 'test-klucz';
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  auth = await import('../../lib/auth.js');
  await db.ensureDb();
  q = db.sql();
  [{ id: uid }] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES ('kasia', 'x', FALSE) RETURNING id`;
});

after(async () => { globalThis.fetch = realFetch; delete process.env.ANTHROPIC_API_KEY; if (pool) await pool.end(); });

test('wynik: karta z narzędzia, źródło z wyszukiwania, druga prośba z pamięci bez wywołania API', { skip }, async () => {
  const [{ value: terp } = {}] = await q`SELECT value FROM options WHERE kind = 'terpene' ORDER BY value LIMIT 1`;
  mock({ stop_reason: 'tool_use', usage: usage(2), content: [search('https://producent.pl/pink-kush'),
    card({ description: 'Indica o słodkim aromacie.', kind: 'indica', thc: 20, cbd: 0.5, terpenes: terp ? [terp] : [], taste: 'słodki', confidence: 'średnia', sources: ['https://producent.pl/pink-kush'] })] });
  const r = await suggest('Aurora', 'Pink Kush');
  assert.equal(r.status, 200);
  assert.equal(r.json.cached, false);
  assert.equal(r.json.suggestion.thc, 20);
  assert.deepEqual(r.json.sources, [{ title: 'Źródło', url: 'https://producent.pl/pink-kush' }]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tools[0].allowed_domains, undefined);
  mock();
  const again = await suggest('aurora', 'PINK KUSH');
  assert.equal(again.json.cached, true);
  assert.equal(calls.length, 0);
});

test('„nie znaleziono” zapamiętane na 7 dni, potem nowa próba', { skip }, async () => {
  mock({ stop_reason: 'end_turn', usage: usage(0), content: [{ type: 'text', text: 'Brak informacji.' }] });
  assert.equal((await suggest('Nikt', 'Nieznana')).status, 404);
  mock();
  assert.equal((await suggest('Nikt', 'Nieznana')).status, 404);
  assert.equal(calls.length, 0, 'ponowna próba nie woła API');
  await q`UPDATE strain_suggestions SET created_at = now() - interval '8 days' WHERE key = 'nikt|nieznana'`;
  mock({ stop_reason: 'end_turn', usage: usage(0), content: [{ type: 'text', text: 'Brak.' }] });
  await suggest('Nikt', 'Nieznana');
  assert.equal(calls.length, 1);
});

test('pause_turn: wznowienie z dotychczasową treścią; brak karty po wyszukiwaniu: wymuszone narzędzie', { skip }, async () => {
  mock(
    { stop_reason: 'pause_turn', usage: usage(1), content: [search('https://a.pl/x')] },
    { stop_reason: 'end_turn', usage: usage(1), content: [{ type: 'text', text: 'Znalazłem dane.' }] },
    { stop_reason: 'tool_use', usage: usage(0), content: [card({ description: 'Hybryda.', kind: 'hybryda', thc: null, cbd: null, terpenes: [], taste: '', confidence: 'niska', sources: [] })] },
  );
  const r = await suggest('Spectrum', 'Red No 2');
  assert.equal(r.status, 200);
  assert.equal(r.json.suggestion.kind, 'hybryda');
  assert.equal(calls.length, 3);
  assert.equal(calls[1].messages.at(-1).role, 'assistant');
  assert.deepEqual(calls[2].tool_choice, { type: 'tool', name: 'karta_odmiany' });
});

test('błąd API: 502, bez wpisu w pamięci podręcznej', { skip }, async () => {
  mock(new Response('przeciążenie', { status: 529 }));
  assert.equal((await suggest('Błąd', 'Odmiana')).status, 502);
  assert.equal((await q`SELECT count(*)::int AS n FROM strain_suggestions WHERE key = 'błąd|odmiana'`)[0].n, 0);
});
