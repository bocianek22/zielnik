// Narzędzie admina „Zdjęcie z apteki → CSV”: zapytanie do Claude API (vision), walidacja odpowiedzi
// i zamiana na wiersze katalogu. Bez importów serwerowych: część (CSV, wiersze importu) używa też panel w przeglądarce.

export const DEFAULT_VISION_MODEL = 'claude-opus-5-5';
export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 1_200_000; // po zdekodowaniu base64, jedno zdjęcie
export const MAX_TOTAL_BYTES = 3_300_000; // limit treści żądania na Vercel to 4,5 MB, a base64 dokłada ok. 1/3
export const IMAGE_MAX_PX = 1800; // dłuższy bok po zmniejszeniu w przeglądarce: drobny druk cennika ma być czytelny

const FORMS = ['susz', 'olej', 'pen'];
const KINDS = ['indica', 'sativa', 'hybryda'];
const CONC_UNITS = ['%', 'mg/ml', 'mg/g'];
// pola, które model może oznaczyć jako niepewne (i które admin poprawia w tabeli)
export const FIELDS = ['producer', 'name', 'registeredName', 'thc', 'cbd', 'concUnit', 'form', 'size', 'unit', 'price', 'kind'];
const MODEL_FIELDS = ['registeredName', 'producer', 'strainName', 'thc', 'cbd', 'concUnit', 'form', 'size', 'unit', 'price', 'kind'];

// Schemat odpowiedzi (structured outputs). Same napisy: brak wartości to "", liczby parsuje serwer.
export const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['cannabis', ...MODEL_FIELDS, 'uncertain'],
        properties: {
          cannabis: { type: 'boolean', description: 'true tylko dla produktów z konopi medycznych (susz, ekstrakt/olej, wkład)' },
          registeredName: { type: 'string', description: 'pełna nazwa rejestrowa jak na liście, np. "Cannabis flos Aurora THC 22%, CBD <1%"' },
          producer: { type: 'string', description: 'producent lub podmiot odpowiedzialny' },
          strainName: { type: 'string', description: 'nazwa handlowa odmiany, jeśli widoczna (np. "Pink Kush"), inaczej ""' },
          thc: { type: 'string', description: 'stężenie THC jako liczba z kropką, np. "22" lub "25"; "<1" gdy podano tylko górną granicę; "" gdy brak' },
          cbd: { type: 'string', description: 'stężenie CBD jak wyżej' },
          concUnit: { type: 'string', enum: ['%', 'mg/ml', 'mg/g', ''] },
          form: { type: 'string', enum: ['susz', 'olej', 'pen', ''] },
          size: { type: 'string', description: 'wielkość opakowania jako liczba, np. "10" (dla 10 g) lub "30" (dla 30 ml); "" gdy brak' },
          unit: { type: 'string', enum: ['g', 'ml', ''] },
          price: { type: 'string', description: 'cena opakowania w zł jako liczba z kropką, jeśli widoczna, inaczej ""' },
          kind: { type: 'string', enum: ['indica', 'sativa', 'hybryda', ''] },
          uncertain: { type: 'array', items: { type: 'string', enum: MODEL_FIELDS }, description: 'pola odczytane z wątpliwościami' },
        },
      },
    },
  },
};

export const SYSTEM = `Odczytujesz zdjęcia list produktów, półek lub cenników aptek w Polsce i przepisujesz pozycje z konopi medycznych (susz, ekstrakty/oleje, wkłady do waporyzatorów).
Zasady:
- Przepisuj tylko to, co widać. Niczego nie zgaduj ani nie uzupełniaj z pamięci; brak wartości to "".
- Pomijaj inne leki i produkty (cannabis=false lub brak pozycji).
- Ta sama pozycja widoczna na kilku zdjęciach to jeden wiersz.
- Nazwy olejów często zaczynają się od „Extractum” lub zawierają „extractum” (np. „Cannabis sativae extractum …”, „Extractum Cannabis …”): postać "olej", stężenie zwykle w mg/ml, opakowanie w ml.
- Wkłady, pody, kartridże, pen: postać "pen", opakowanie w ml.
- „Cannabis flos”, kwiat, susz: postać "susz", stężenie w %, opakowanie w g.
- Liczby zapisuj z kropką dziesiętną, bez jednostek i bez spacji.
- Każde pole, którego nie jesteś pewien (nieostre, ucięte, niejednoznaczne), wpisz do "uncertain".`;

const str = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
// klucz porównania jak w lib/enrich.js: małe litery, bez polskich znaków i interpunkcji
export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/gi, 'l')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Postać z nazwy ma pierwszeństwo przed odczytem modelu. Najpierw pen: wkład z ekstraktem też bywa „extractum”.
export function detectForm(text, hint = '') {
  const t = String(text ?? '').toLowerCase();
  if (/\bpen\b|wkład|wklad|kartrid|cartridge|\bpod\b|\bpody\b|vape/.test(t)) return 'pen';
  if (/extract|ekstrakt|\boleju?\b|\boil\b|krople/.test(t)) return 'olej';
  if (/\bflos\b|susz|\bkwiat/.test(t)) return 'susz';
  return FORMS.includes(hint) ? hint : 'susz';
}
// Jednostka opakowania wynika z postaci: olej i pen w ml, susz w g
export const unitFor = (form) => (form === 'susz' ? 'g' : 'ml');

// "22", "22,5", "22 %" -> "22" / "22.5"; "<1", "≤ 1" -> "<1"; inne -> ""
export function cleanConc(v) {
  const s = String(v ?? '').replace(',', '.').replace(/[%\s]|mg\/?(ml|g)/gi, '');
  const m = s.match(/^(<|≤|<=)?(\d{1,3}(?:\.\d{1,2})?)$/);
  if (!m) return '';
  return (m[1] ? '<' : '') + String(Number(m[2]));
}
function cleanNum(v, max) {
  const s = String(v ?? '').replace(/\s/g, '').replace(/zł|pln/gi, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return '';
  const n = Number(s);
  return n > 0 && n <= max ? String(Math.round(n * 100) / 100) : '';
}

// Dopasowanie do katalogu Zielnika (data/odmiany.json): kanoniczny producent i nazwa, żeby import
// trafiał w istniejący wiersz (producent + nazwa) zamiast tworzyć duplikat. Niejednoznaczne: bez zmian.
export function matchReference(row, reference = []) {
  const reg = norm(row.registeredName), p = norm(row.producer), n = norm(row.strain);
  const producerOk = (e) => [e.producer, ...(e.producerAliases || [])].some((x) => norm(x) === p);
  const nameOk = (e) => [e.name, ...(e.aliases || [])].some((x) => norm(x) === n);
  let found = reg ? reference.filter((e) => e.registeredName && norm(e.registeredName) === reg) : [];
  // pod jedną nazwą rejestrową bywają różne odmiany w kolejnych partiach: widoczna nazwa odmiany ma pierwszeństwo
  if (n) found = found.filter(nameOk);
  if (found.length !== 1 && p && n) found = reference.filter((e) => producerOk(e) && nameOk(e));
  if (found.length !== 1 && p) {
    const prod = reference.find(producerOk);
    return prod ? { producer: prod.producer } : null;
  }
  return found.length === 1 ? { producer: found[0].producer, name: found[0].name } : null;
}

// Surowa pozycja z modelu -> wiersz tabeli podglądu (z listą niepewnych pól)
export function normalizeItem(it, reference = []) {
  if (!it || typeof it !== 'object' || it.cannabis === false) return null;
  const uncertain = new Set((Array.isArray(it.uncertain) ? it.uncertain : []).map((f) => (f === 'strainName' ? 'name' : f)).filter((f) => FIELDS.includes(f)));
  const registeredName = str(it.registeredName, 160);
  // nazwa odmiany bywa tylko w nawiasie na końcu nazwy rejestrowej: „… CBD <1% (Pink Kush)”
  const strain = str(it.strainName, 80) || (registeredName.match(/\(([^()\d]{2,40})\)\s*$/)?.[1].trim() ?? '');
  let producer = str(it.producer, 60);
  const modelForm = FORMS.includes(it.form) ? it.form : '';
  const form = detectForm(`${registeredName} ${strain}`, modelForm);
  if (modelForm && modelForm !== form) uncertain.add('form');
  const unit = unitFor(form);
  if (it.unit && it.unit !== unit) uncertain.add('unit');
  let concUnit = CONC_UNITS.includes(it.concUnit) ? it.concUnit : (form === 'susz' ? '%' : '');
  if (form === 'susz' && concUnit !== '%') { uncertain.add('concUnit'); concUnit = '%'; }
  const thc = cleanConc(it.thc), cbd = cleanConc(it.cbd);
  if (str(it.thc, 20) && !thc) uncertain.add('thc');
  if (str(it.cbd, 20) && !cbd) uncertain.add('cbd');
  let name = strain || registeredName;
  const ref = matchReference({ registeredName, producer, strain }, reference);
  let matched = false;
  if (ref) {
    producer = ref.producer;
    if (ref.name) { name = ref.name; matched = true; }
  }
  if (!producer) uncertain.add('producer');
  if (!name) uncertain.add('name');
  if (!producer && !name) return null;
  return {
    producer, name: name.slice(0, 80), registeredName, thc, cbd, concUnit, form,
    size: cleanNum(it.size, 1000), unit, price: cleanNum(it.price, 100000),
    kind: KINDS.includes(it.kind) ? it.kind : '',
    matched, uncertain: FIELDS.filter((f) => uncertain.has(f)),
  };
}

// Odpowiedź Messages API -> { rows } albo { error }. Na Opus 5.5 pierwszy blok to "thinking": czytamy bloki "text".
export function parseModelResponse(j, reference = []) {
  if (!j || typeof j !== 'object') return { error: 'Pusta odpowiedź modelu.' };
  if (j.stop_reason === 'refusal') return { error: 'Model odmówił odczytu tego zdjęcia. Spróbuj innego ujęcia.' };
  if (j.stop_reason === 'max_tokens') return { error: 'Na zdjęciu jest za dużo pozycji. Sfotografuj mniejszy fragment listy.' };
  // po przełączeniu modelu (fallbacks) liczy się tylko tekst za ostatnim blokiem "fallback"
  const blocks = Array.isArray(j.content) ? j.content : [];
  const last = blocks.map((b) => b?.type).lastIndexOf('fallback');
  const text = blocks.slice(last + 1).filter((b) => b?.type === 'text').map((b) => b.text).join('');
  let raw;
  try { raw = JSON.parse(text); } catch { return { error: 'Model zwrócił odpowiedź w nieoczekiwanym formacie. Spróbuj ponownie.' }; }
  if (!raw || !Array.isArray(raw.items)) return { error: 'Model zwrócił odpowiedź w nieoczekiwanym formacie. Spróbuj ponownie.' };
  const rows = [];
  const seen = new Set();
  for (const it of raw.items.slice(0, 200)) {
    const r = normalizeItem(it, reference);
    if (!r) continue;
    const k = `${norm(r.producer)}|${norm(r.name)}`;
    if (seen.has(k)) continue; // ta sama pozycja z dwóch zdjęć
    seen.add(k);
    rows.push(r);
  }
  return { rows };
}

// data:image/jpeg;base64,... -> { media_type, data, bytes } albo null
export function parseDataUrl(s) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(s ?? ''));
  if (!m) return null;
  return { media_type: m[1], data: m[2], bytes: Math.floor(m[2].length * 3 / 4) };
}

// Walidacja listy zdjęć z żądania: { images } albo { error }
export function validateImages(list) {
  if (!Array.isArray(list) || !list.length) return { error: 'Dodaj co najmniej jedno zdjęcie.' };
  if (list.length > MAX_IMAGES) return { error: `Najwyżej ${MAX_IMAGES} zdjęcia naraz.` };
  const images = [];
  let total = 0;
  for (const s of list) {
    const img = parseDataUrl(s);
    if (!img) return { error: 'Nieobsługiwany format zdjęcia (JPEG, PNG lub WebP).' };
    if (img.bytes > MAX_IMAGE_BYTES) return { error: 'Zdjęcie jest za duże. Zmniejsz je i spróbuj ponownie.' };
    total += img.bytes;
    images.push(img);
  }
  if (total > MAX_TOTAL_BYTES) return { error: 'Zdjęcia są razem za duże. Wyślij mniej naraz.' };
  return { images };
}

// Modele, które przyjmują fallbacks: "default" (ponowienie po odmowie klasyfikatora na innym modelu)
const FALLBACK_MODELS = /^claude-(opus-5-5|opus-5|fable-5-1|sonnet-5-5)$/;

export function buildRequest(images, model = DEFAULT_VISION_MODEL) {
  const body = {
    model,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        ...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.media_type, data: i.data } })),
        { type: 'text', text: `Przepisz pozycje z konopi medycznych z ${images.length > 1 ? `tych ${images.length} zdjęć` : 'tego zdjęcia'}.` },
      ],
    }],
  };
  const headers = { 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
  if (FALLBACK_MODELS.test(model)) { body.fallbacks = 'default'; headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; }
  return { body, headers };
}

// Wywołanie Claude API. Nie loguje ani nie zwraca treści zdjęć czy odpowiedzi; błąd to tylko status i typ.
export async function extractRows({ images, apiKey, model = DEFAULT_VISION_MODEL, reference = [], fetchImpl = fetch, timeoutMs = 55_000 }) {
  const { body, headers } = buildRequest(images, model);
  let r;
  try {
    r = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { ...headers, 'x-api-key': apiKey }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return { error: timeout ? 'Odczyt trwał za długo. Spróbuj z mniejszą liczbą zdjęć.' : 'Brak połączenia z usługą odczytu. Spróbuj ponownie.', status: 502, log: timeout ? 'timeout' : 'network' };
  }
  if (!r.ok) {
    const type = (await r.json().catch(() => null))?.error?.type || '';
    const msg = r.status === 401 || r.status === 403 ? 'Klucz ANTHROPIC_API_KEY jest nieprawidłowy lub nie ma dostępu do modelu.'
      : r.status === 429 || r.status === 529 ? 'Usługa odczytu jest chwilowo przeciążona. Spróbuj za chwilę.'
      : r.status === 400 || r.status === 404 ? 'Usługa odrzuciła zapytanie (sprawdź ZIELNIK_VISION_MODEL).'
      : 'Nie udało się odczytać zdjęcia. Spróbuj ponownie później.';
    return { error: msg, status: 502, log: `Anthropic ${r.status} ${type}`.trim() };
  }
  const out = parseModelResponse(await r.json().catch(() => null), reference);
  return out.error ? { ...out, status: 422 } : { rows: out.rows };
}

// ---- CSV i import (także w przeglądarce) ----

// Wiersz tabeli -> obiekt w formacie importu katalogu (nagłówki jak w lib/catalog.js KEYS).
// THC/CBD w katalogu są w %, więc stężenia w mg/ml i górne granice („<1”) zostają tylko w kolumnie „Stężenie”.
export function toCatalogRow(r) {
  // wartości poprawione ręcznie w tabeli też przechodzą przez cleanConc („22,5 %” -> 22.5, „≤1” -> pomijane)
  const pct = (v) => { const c = cleanConc(v); return r.concUnit === '%' && c && !c.startsWith('<') ? c : ''; };
  return { producent: r.producer, odmiana: r.name, thc: pct(r.thc), cbd: pct(r.cbd), rodzaj: r.kind || '', postać: r.form || 'susz', dostępność: '' };
}

export const CSV_HEADER = ['Producent', 'Odmiana', 'THC', 'CBD', 'Rodzaj', 'Postać', 'Dostępność', 'Nazwa rejestrowa', 'Stężenie', 'Opakowanie', 'Jednostka', 'Cena zł'];

const cell = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const dec = (v) => String(v ?? '').replace('.', ',');

export function concText(r) {
  const u = r.concUnit || '';
  return [r.thc && `THC ${dec(r.thc)} ${u}`.trim(), r.cbd && `CBD ${dec(r.cbd)} ${u}`.trim()].filter(Boolean).join(', ');
}

// CSV z separatorem ";" i BOM (Excel); pierwsze kolumny wczyta „Wczytaj CSV” w katalogu, reszta jest informacyjna
export function toCsv(rows) {
  const lines = [CSV_HEADER.join(';')];
  for (const r of rows) {
    const c = toCatalogRow(r);
    lines.push([c.producent, c.odmiana, dec(c.thc), dec(c.cbd), c.rodzaj, c.postać, c.dostępność,
      r.registeredName, concText(r), dec(r.size), r.size ? r.unit : '', dec(r.price)].map(cell).join(';'));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
