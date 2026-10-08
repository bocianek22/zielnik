// Podpowiedź karty odmiany z internetu (Claude + wyszukiwanie w sieci). Czyste funkcje: budowa zapytania i odczyt odpowiedzi.
import { KINDS } from './kinds.js';

export const SUGGEST_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const MAX_SEARCHES = 4;

const SYSTEM = `Przygotowujesz krótką, ostrożną kartę odmiany konopi medycznej dostępnej w polskich aptekach, na podstawie wyszukiwania w internecie.
Jak szukać (najwyżej ${MAX_SEARCHES} wyszukiwania):
1. Produkt producenta: strona producenta lub dystrybutora, ulotka, polskie serwisy o medycznej marihuanie i aptekach (nazwy apteczne bywają inne niż nazwy genetyki, np. „Red No 2”, „Pink Kush 20/1”).
2. Genetyka: sama nazwa odmiany bez producenta, np. „Lemon Skunk strain” (Leafly, AllBud, SeedFinder, Wikileaf i podobne).
Gdy wyniki producenta i genetyki się różnią, THC/CBD bierz od producenta, a smak, terpeny i efekty z opisu genetyki.
Zasady: używaj wyłącznie informacji z wyników wyszukiwania; czego nie znajdziesz, zostaw jako null lub pustą listę i nic nie zgaduj.
Nie podawaj porad medycznych, dawkowania ani twierdzeń o leczeniu; efekty opisuj jako „zwykle opisywane przez użytkowników”.
Opis po polsku, 2-4 zdania: pochodzenie i rodzaj, aromat i smak, zwykle opisywane efekty.
Na koniec wywołaj narzędzie karta_odmiany dokładnie raz, także gdy znalazłeś tylko część danych (wtedy pewność „niska”).`;

const CARD_TOOL = {
  name: 'karta_odmiany',
  description: 'Zapisuje kartę odmiany zebraną z wyników wyszukiwania.',
  input_schema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'Opis po polsku, 2-4 zdania; pusty, gdy brak danych' },
      kind: { type: ['string', 'null'], enum: ['indica', 'sativa', 'hybryda', null] },
      thc: { type: ['number', 'null'], description: 'Typowe THC w %' },
      cbd: { type: ['number', 'null'], description: 'Typowe CBD w %' },
      terpenes: { type: 'array', items: { type: 'string' } },
      taste: { type: 'string', description: 'Smak i aromat, kilka słów po polsku' },
      confidence: { type: 'string', enum: ['niska', 'średnia', 'wysoka'] },
      sources: { type: 'array', items: { type: 'string' }, description: 'Adresy stron, z których pochodzą dane' },
    },
    required: ['description', 'kind', 'thc', 'cbd', 'terpenes', 'taste', 'confidence', 'sources'],
  },
};

// Domeny z SUGGEST_DOMAINS zawężają wyszukiwanie; domyślnie cały internet, wyniki z perspektywy Polski
export function buildRequest({ producer, name, terpeneOptions, domains = [] }) {
  const search = { type: 'web_search_20250305', name: 'web_search', max_uses: MAX_SEARCHES,
    user_location: { type: 'approximate', country: 'PL', timezone: 'Europe/Warsaw' } };
  if (domains.length) search.allowed_domains = domains;
  return {
    model: SUGGEST_MODEL, max_tokens: 2500, system: SYSTEM,
    tools: [search, CARD_TOOL],
    messages: [{ role: 'user', content: `Producent: „${producer}”, odmiana: „${name}”.\nZnajdź: rodzaj, typowe THC i CBD (%), dominujące terpeny (tylko z listy: ${terpeneOptions.join(', ')}), smak i aromat oraz krótki opis.` }],
  };
}

const httpUrl = (u) => typeof u === 'string' && /^https?:\/\/[^\s]+$/.test(u);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

// Pierwszy obiekt JSON w tekście (zapas, gdy model nie wywołał narzędzia); bloki tekstu z cytatami sklejamy bez separatora
function jsonFromText(blocks) {
  const text = blocks.filter((x) => x.type === 'text').map((x) => x.text).join('');
  const m = text.match(/\{[\s\S]*\}/);
  try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

// Odczyt odpowiedzi: karta z narzędzia (albo JSON w tekście), walidacja pól, źródła tylko spośród faktycznych wyników wyszukiwania
export function parseResponse(blocks, terpeneOptions) {
  const card = blocks.find((x) => x.type === 'tool_use' && x.name === CARD_TOOL.name)?.input || jsonFromText(blocks);
  if (!card || typeof card !== 'object') return null;

  const results = [];
  for (const b of blocks) if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) for (const r of b.content) if (httpUrl(r?.url)) results.push(r);
  const cited = [];
  for (const b of blocks) if (b.type === 'text') for (const c of b.citations || []) if (httpUrl(c?.url)) cited.push(c);
  const known = new Map([...results, ...cited].map((r) => [r.url, r]));

  const sources = [];
  const add = (r) => { if (r && !sources.some((s) => s.url === r.url)) sources.push({ title: String(r.title || host(r.url)).slice(0, 120), url: r.url }); };
  (Array.isArray(card.sources) ? card.sources : []).forEach((u) => add(known.get(u)));
  if (!sources.length) cited.forEach(add);
  if (!sources.length) results.slice(0, 3).forEach(add);

  const num = (v) => { const n = typeof v === 'string' ? Number(v.replace(',', '.').replace('%', '')) : v; return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 40 ? Math.round(n * 10) / 10 : null; };
  const allowed = new Map(terpeneOptions.map((t) => [t.toLowerCase(), t]));
  const kind = String(card.kind ?? '').toLowerCase();
  const suggestion = {
    description: String(card.description ?? '').trim().slice(0, 900),
    kind: KINDS.some((k) => k.value === kind) ? kind : null,
    thc: num(card.thc), cbd: num(card.cbd),
    terpenes: [...new Set((Array.isArray(card.terpenes) ? card.terpenes : []).map((t) => allowed.get(String(t).trim().toLowerCase())).filter(Boolean))].slice(0, 6),
    taste: String(card.taste ?? '').trim().slice(0, 120),
    confidence: ['niska', 'średnia', 'wysoka'].includes(card.confidence) ? card.confidence : 'niska',
  };
  const s = suggestion;
  const any = s.description || s.kind || s.thc != null || s.cbd != null || s.terpenes.length || s.taste;
  // bez żadnego źródła z wyszukiwania karta jest zgadywaniem modelu
  if (!any || !sources.length) return null;
  return { suggestion, sources: sources.slice(0, 4) };
}

// Zużycie do dziennika (bez nazw odmian i danych użytkownika): pozwala śledzić koszt podpowiedzi
export function usageOf(j) {
  const u = j?.usage || {};
  return { searches: u.server_tool_use?.web_search_requests ?? 0, input: u.input_tokens ?? 0, output: u.output_tokens ?? 0 };
}
