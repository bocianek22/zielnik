import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, parseResponse, usageOf } from '../lib/strain-suggest.js';

const TERP = ['Mircen', 'Limonen', 'Kariofilen'];
const search = (...urls) => ({ type: 'web_search_tool_result', content: urls.map((url) => ({ type: 'web_search_result', url, title: `T ${url}` })) });
const card = (input) => ({ type: 'tool_use', name: 'karta_odmiany', input });

test('buildRequest: cały internet z perspektywy PL, zawężenie tylko przy SUGGEST_DOMAINS', () => {
  const r = buildRequest({ producer: 'Aurora', name: 'Pink Kush', terpeneOptions: TERP });
  const ws = r.tools.find((t) => t.name === 'web_search');
  assert.equal(ws.allowed_domains, undefined);
  assert.equal(ws.user_location.country, 'PL');
  assert.ok(r.tools.some((t) => t.name === 'karta_odmiany'));
  assert.match(r.messages[0].content, /Pink Kush/);
  assert.deepEqual(buildRequest({ producer: 'a', name: 'b', terpeneOptions: TERP, domains: ['leafly.com'] }).tools[0].allowed_domains, ['leafly.com']);
});

test('parseResponse: karta z narzędzia, walidacja pól, źródła tylko z wyników wyszukiwania', () => {
  const out = parseResponse([
    search('https://www.leafly.com/strains/pink-kush', 'https://example.com/x'),
    { type: 'text', text: 'Znalazłem.' },
    card({ description: 'Opis.', kind: 'Indica', thc: '22,5%', cbd: 99, terpenes: ['mircen', 'Pinen', 'Mircen'], taste: 'słodki', confidence: 'średnia',
      sources: ['https://www.leafly.com/strains/pink-kush', 'https://zmyslone.pl/'] }),
  ], TERP);
  assert.deepEqual(out.suggestion, { description: 'Opis.', kind: 'indica', thc: 22.5, cbd: null, terpenes: ['Mircen'], taste: 'słodki', confidence: 'średnia' });
  assert.deepEqual(out.sources.map((s) => s.url), ['https://www.leafly.com/strains/pink-kush']);
});

test('parseResponse: JSON w tekście pociętym na bloki z cytatami (dawny błąd sklejania przez \\n)', () => {
  const out = parseResponse([
    search('https://seedfinder.eu/a'),
    { type: 'text', text: '{"description": "Hybryda o ', citations: [] },
    { type: 'text', text: 'cytrusowym aromacie.', citations: [{ url: 'https://seedfinder.eu/a', title: 'SF' }] },
    { type: 'text', text: '", "kind": "hybryda", "thc": 18, "cbd": null, "terpenes": ["Limonen"], "taste": "cytryna", "confidence": "wysoka"}' },
  ], TERP);
  assert.equal(out.suggestion.description, 'Hybryda o cytrusowym aromacie.');
  assert.deepEqual(out.sources, [{ title: 'SF', url: 'https://seedfinder.eu/a' }]);
});

test('parseResponse: część danych wystarcza, pusta karta albo brak wyszukiwania to brak wyniku', () => {
  const partial = parseResponse([search('https://p.pl/'), card({ description: '', kind: null, thc: 20, cbd: 1, terpenes: [], taste: '', confidence: 'niska', sources: [] })], TERP);
  assert.equal(partial.suggestion.thc, 20);
  assert.equal(partial.sources[0].url, 'https://p.pl/');
  assert.equal(parseResponse([search('https://p.pl/'), card({ description: '', kind: null, thc: null, cbd: null, terpenes: [], taste: '', confidence: 'niska', sources: [] })], TERP), null);
  assert.equal(parseResponse([card({ description: 'Zgadnięte', kind: 'sativa', thc: 20, cbd: 0, terpenes: [], taste: '', confidence: 'niska', sources: [] })], TERP), null);
  assert.equal(parseResponse([{ type: 'text', text: 'Nie znalazłem.' }], TERP), null);
});

test('usageOf: liczba wyszukiwań i tokeny', () => {
  assert.deepEqual(usageOf({ usage: { input_tokens: 10, output_tokens: 2, server_tool_use: { web_search_requests: 3 } } }), { searches: 3, input: 10, output: 2 });
  assert.deepEqual(usageOf({}), { searches: 0, input: 0, output: 0 });
});
