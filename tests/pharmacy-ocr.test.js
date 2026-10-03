// Zdjęcie z apteki -> CSV: parser odpowiedzi modelu, rozpoznanie postaci i jednostek, walidacja, CSV (bez sieci i bazy)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA, buildRequest, cleanConc, detectForm, extractRows, normalizeItem, parseModelResponse, toCatalogRow, toCsv, unitFor, validateImages,
} from '../lib/pharmacy-ocr.js';
import { csvToObjects } from '../lib/csv.js';
import { pharmacySearchUrl } from '../lib/pharmacies.js';

const REF = [
  { producer: 'Aurora', producerAliases: ['Aurora Deutschland GmbH'], name: 'Pink Kush', aliases: ['Aurora Pink Kush'], registeredName: 'Cannabis flos Aurora THC 20%, CBD < 1% (Pink Kush)' },
  { producer: 'S-LAB', producerAliases: [], name: 'Ghost Train Haze', aliases: [], registeredName: 'Cannabis flos S-LAB THC 22%, CBD ≤ 1%' },
];
const item = (o) => ({
  cannabis: true, registeredName: '', producer: '', strainName: '', thc: '', cbd: '', concUnit: '', form: '', size: '', unit: '', price: '', kind: '', uncertain: [], ...o,
});
const reply = (items, extra = {}) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify({ items }) }],
  ...extra,
});
const IMG = 'data:image/jpeg;base64,' + Buffer.from('obraz').toString('base64');

test('postać: Extractum -> olej, wkład/pen -> pen (także z ekstraktem), flos -> susz', () => {
  assert.equal(detectForm('Cannabis sativae extractum THC 25 mg/ml'), 'olej');
  assert.equal(detectForm('Extractum Cannabis Spectrum THC 10'), 'olej');
  assert.equal(detectForm('Wkład do waporyzatora, extractum THC 80%'), 'pen');
  assert.equal(detectForm('Cannabis extractum pen 0,5 ml'), 'pen');
  assert.equal(detectForm('Cartridge Cannabis'), 'pen');
  assert.equal(detectForm('Cannabis flos Aurora THC 22%'), 'susz');
  assert.equal(detectForm('Coś bez wskazówek', 'olej'), 'olej', 'bez słów kluczowych liczy się odczyt modelu');
  assert.equal(detectForm('Podkowa'), 'susz', '„pod” tylko jako osobne słowo');
  assert.equal(unitFor('susz'), 'g');
  assert.equal(unitFor('olej'), 'ml');
  assert.equal(unitFor('pen'), 'ml');
});

test('stężenia: przecinek, procent, górna granica', () => {
  assert.equal(cleanConc('22,5 %'), '22.5');
  assert.equal(cleanConc('25 mg/ml'), '25');
  assert.equal(cleanConc('<1'), '<1');
  assert.equal(cleanConc('≤ 1%'), '<1');
  assert.equal(cleanConc('dużo'), '');
  assert.equal(cleanConc(''), '');
});

test('olej: jednostka ml nawet gdy model podał g, niezgodność oznaczona jako niepewna', () => {
  const r = normalizeItem(item({ registeredName: 'Cannabis sativae extractum THC 25 mg/ml', producer: 'Medicolab', thc: '25', concUnit: 'mg/ml', form: 'susz', size: '30', unit: 'g' }));
  assert.equal(r.form, 'olej');
  assert.equal(r.unit, 'ml');
  assert.ok(r.uncertain.includes('form'));
  assert.ok(r.uncertain.includes('unit'));
  assert.equal(r.name, 'Cannabis sativae extractum THC 25 mg/ml', 'bez nazwy odmiany nazwą jest nazwa rejestrowa');
  // w katalogu THC jest w %, więc mg/ml nie trafia do kolumny THC
  assert.equal(toCatalogRow(r).thc, '');
  assert.equal(toCatalogRow(r).postać, 'olej');
});

test('dopasowanie do katalogu Zielnika: nazwa rejestrowa i alias producenta dają kanoniczny wiersz', () => {
  const a = normalizeItem(item({ registeredName: 'Cannabis flos Aurora THC 20% CBD <1% (Pink Kush)', producer: 'Aurora Deutschland GmbH', thc: '20', cbd: '<1', concUnit: '%' }), REF);
  assert.equal(a.producer, 'Aurora');
  assert.equal(a.name, 'Pink Kush');
  assert.equal(a.matched, true);
  assert.equal(toCatalogRow(a).cbd, '', 'górna granica CBD nie jest wartością');
  assert.equal(toCatalogRow(a).thc, '20');
  const b = normalizeItem(item({ registeredName: 'Cannabis flos Aurora THC 29%', producer: 'Aurora Deutschland GmbH', strainName: 'Sourdough', thc: '29', concUnit: '%' }), REF);
  assert.equal(b.producer, 'Aurora', 'sam producent z aliasu');
  assert.equal(b.name, 'Sourdough');
  assert.equal(b.matched, false);
  const c = normalizeItem(item({ registeredName: 'Cannabis flos S-LAB THC 22%, CBD ≤ 1%', producer: 'S-LAB', strainName: 'Inna Odmiana', thc: '22', concUnit: '%' }), REF);
  assert.equal(c.name, 'Inna Odmiana', 'widoczna nazwa odmiany wygrywa z nazwą rejestrową');
});

test('parser odpowiedzi: pomija bloki thinking, inne leki i duplikaty, oznacza braki', () => {
  const out = parseModelResponse(reply([
    item({ registeredName: 'Cannabis flos S-LAB THC 22%, CBD ≤ 1%', producer: 'S-LAB', thc: '22', cbd: '≤1', concUnit: '%', form: 'susz', size: '10', unit: 'g', price: '459,99', uncertain: ['price', 'strainName', 'nieznane'] }),
    item({ registeredName: 'Cannabis flos S-LAB THC 22%, CBD ≤ 1%', producer: 'S-LAB', thc: '22' }),
    item({ cannabis: false, registeredName: 'Apap 500 mg', producer: 'USP' }),
    item({ registeredName: 'Cannabis flos THC 18%', producer: '', thc: '18', concUnit: '%' }),
    item({ registeredName: '', producer: '' }),
  ]), REF);
  assert.ok(!out.error);
  assert.equal(out.rows.length, 2);
  const [a, b] = out.rows;
  assert.deepEqual([a.producer, a.name, a.thc, a.cbd, a.size, a.unit, a.price], ['S-LAB', 'Ghost Train Haze', '22', '<1', '10', 'g', '459.99']);
  assert.deepEqual(a.uncertain, ['name', 'price'], 'strainName -> name, nieznane pola odrzucone');
  assert.ok(b.uncertain.includes('producer'));
});

test('parser odpowiedzi: odmowa, ucięcie, zły JSON', () => {
  assert.match(parseModelResponse({ stop_reason: 'refusal', content: [] }).error, /odmówił/);
  assert.match(parseModelResponse({ stop_reason: 'max_tokens', content: [] }).error, /za dużo pozycji/);
  assert.match(parseModelResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'nie JSON' }] }).error, /formacie/);
  assert.match(parseModelResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"rows":[]}' }] }).error, /formacie/);
  assert.match(parseModelResponse(null).error, /Pusta/);
});

test('parser odpowiedzi: po przełączeniu modelu liczy się tylko tekst za blokiem fallback', () => {
  const ok = JSON.stringify({ items: [item({ registeredName: 'Cannabis flos THC 18%', producer: 'Tilray', thc: '18', concUnit: '%' })] });
  const out = parseModelResponse({ stop_reason: 'end_turn', content: [
    { type: 'text', text: '{"items":[{"cann' }, { type: 'fallback', from: { model: 'a' }, to: { model: 'b' } }, { type: 'text', text: ok },
  ] });
  assert.equal(out.rows?.length, 1);
});

test('wiersz poprawiony ręcznie: stężenia czyszczone przed importem', () => {
  const c = toCatalogRow({ producer: 'Tilray', name: 'X', thc: '22,5 %', cbd: '≤1', concUnit: '%', form: 'susz', kind: '' });
  assert.equal(c.thc, '22.5');
  assert.equal(c.cbd, '');
  assert.equal(toCatalogRow({ producer: 'T', name: 'X', thc: 'ok. 20', cbd: '', concUnit: '%', form: 'susz' }).thc, '');
});

test('walidacja zdjęć: format, liczba, rozmiar', () => {
  assert.ok(validateImages([IMG]).images);
  assert.match(validateImages([]).error, /co najmniej/);
  assert.match(validateImages('x').error, /co najmniej/);
  assert.match(validateImages([IMG, IMG, IMG, IMG, IMG]).error, /Najwyżej 4/);
  assert.match(validateImages(['data:image/gif;base64,AAAA']).error, /format/);
  assert.match(validateImages(['data:text/html;base64,AAAA']).error, /format/);
  const big = 'data:image/jpeg;base64,' + 'A'.repeat(1_700_000);
  assert.match(validateImages([big]).error, /za duże/);
  const mid = 'data:image/jpeg;base64,' + 'A'.repeat(1_500_000); // ok. 1,1 MB każde, razem za dużo
  assert.match(validateImages([mid, mid, mid, mid]).error, /razem za duże/);
});

test('schemat structured outputs: każdy obiekt zamknięty i z kompletem required', () => {
  const check = (s) => {
    if (s.type === 'object') {
      assert.equal(s.additionalProperties, false);
      assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort());
      Object.values(s.properties).forEach(check);
    }
    if (s.type === 'array') check(s.items);
  };
  check(SCHEMA);
});

test('zapytanie: obrazy base64, schemat, fallback tylko dla obsługiwanych modeli, bez temperature/thinking', () => {
  const imgs = validateImages([IMG, IMG]).images;
  const { body, headers } = buildRequest(imgs);
  assert.equal(body.model, 'claude-opus-5-5');
  assert.equal(body.messages[0].content.filter((c) => c.type === 'image').length, 2);
  assert.equal(body.messages[0].content[0].source.type, 'base64');
  assert.equal(body.output_config.format.type, 'json_schema');
  assert.equal(body.fallbacks, 'default');
  assert.equal(headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  assert.ok(!('temperature' in body) && !('thinking' in body));
  const h = buildRequest(imgs, 'claude-haiku-4-5');
  assert.ok(!('fallbacks' in h.body) && !h.headers['anthropic-beta']);
});

test('extractRows z podmienionym fetch: klucz w nagłówku, wiersze, błędy bez treści odpowiedzi', async () => {
  const images = validateImages([IMG]).images;
  let seen;
  const ok = async (url, init) => { seen = { url, init }; return new Response(JSON.stringify(reply([item({ registeredName: 'Cannabis flos S-LAB THC 22%, CBD ≤ 1%', producer: 'S-LAB', thc: '22', concUnit: '%' })])), { status: 200 }); };
  const r = await extractRows({ images, apiKey: 'sk-test', reference: REF, fetchImpl: ok });
  assert.equal(seen.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(seen.init.headers['x-api-key'], 'sk-test');
  assert.equal(seen.init.headers['anthropic-version'], '2023-06-01');
  assert.equal(r.rows[0].name, 'Ghost Train Haze');

  const fail = async () => new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'tajne dane' } }), { status: 401 });
  const e = await extractRows({ images, apiKey: 'x', fetchImpl: fail });
  assert.equal(e.status, 502);
  assert.match(e.error, /ANTHROPIC_API_KEY/);
  assert.equal(e.log, 'Anthropic 401 authentication_error');
  assert.ok(!JSON.stringify(e).includes('tajne'));

  const net = async () => { throw new TypeError('fetch failed'); };
  assert.equal((await extractRows({ images, apiKey: 'x', fetchImpl: net })).log, 'network');
  const refused = async () => new Response(JSON.stringify({ stop_reason: 'refusal', content: [] }), { status: 200 });
  assert.equal((await extractRows({ images, apiKey: 'x', fetchImpl: refused })).status, 422);
});

test('CSV: separator ;, BOM, kolumny importu katalogu i przecinek dziesiętny', () => {
  const rows = parseModelResponse(reply([
    item({ registeredName: 'Cannabis flos Aurora THC 20%, CBD < 1% (Pink Kush)', producer: 'Aurora', thc: '20.5', cbd: '<1', concUnit: '%', size: '10', price: '399.5' }),
    item({ registeredName: 'Extractum Cannabis "Spectrum"; THC 10', producer: 'Spectrum', thc: '10', cbd: '10', concUnit: 'mg/ml', size: '30' }),
  ]), REF).rows;
  const csv = toCsv(rows);
  assert.ok(csv.startsWith('﻿Producent;Odmiana;THC;CBD;Rodzaj;Postać;Dostępność;'));
  const objs = csvToObjects(csv);
  assert.equal(objs.length, 2);
  // te same nagłówki rozpoznaje import katalogu (lib/catalog.js KEYS: producent, odmiana, thc, cbd, rodzaj, postać, dostępność)
  assert.equal(objs[0].Producent, 'Aurora');
  assert.equal(objs[0].Odmiana, 'Pink Kush');
  assert.equal(objs[0].THC, '20,5');
  assert.equal(objs[0].CBD, '');
  assert.equal(objs[0].Jednostka, 'g');
  assert.equal(objs[0]['Cena zł'], '399,5');
  assert.equal(objs[1]['Postać'], 'olej');
  assert.equal(objs[1].Jednostka, 'ml');
  assert.equal(objs[1].THC, '', 'mg/ml nie trafia do kolumny THC w %');
  assert.equal(objs[1]['Stężenie'], 'THC 10 mg/ml, CBD 10 mg/ml');
  assert.equal(objs[1]['Nazwa rejestrowa'], 'Extractum Cannabis "Spectrum"; THC 10', 'cudzysłów i średnik w polu');
});

test('gdziepolek: znana strona produktu, inaczej wyszukiwanie w obrębie gdziepolek.pl', () => {
  const page = 'https://www.gdziepolek.pl/produkty/100242/cannabis-flos-thc-22-cbd-1-aurora-deutschland-gmbh-ghost-train-haze-marihuana-lecznicza-medyczna/apteki';
  assert.equal(pharmacySearchUrl({ url: page, producer: 'Aurora' }), page);
  assert.equal(pharmacySearchUrl({ url: 'https://zla.example/x', producer: 'Aurora', name: 'Pink  Kush' }),
    'https://www.google.com/search?q=site%3Agdziepolek.pl%20Aurora%20Pink%20Kush');
  assert.equal(pharmacySearchUrl({ registeredName: 'Cannabis flos Aurora THC 22%, CBD <1%' }),
    'https://www.google.com/search?q=site%3Agdziepolek.pl%20Cannabis%20flos%20Aurora%20THC%2022%25%2C%20CBD%20%3C1%25');
  assert.equal(pharmacySearchUrl({}), 'https://www.gdziepolek.pl/');
});
