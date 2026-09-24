import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { logError } from '@/lib/errorlog';
import { listOptions } from '@/lib/strains';
import { KINDS } from '@/lib/kinds';

export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const DOMAINS = (process.env.SUGGEST_DOMAINS || 'leafly.com,allbud.com,wikileaf.com,seedfinder.eu').split(',').map((s) => s.trim()).filter(Boolean);

const SYSTEM = `Przygotowujesz krótką, ostrożną kartę charakterystyki odmiany konopi na podstawie wyników wyszukiwania w internecie.
Zasady: używaj wyłącznie informacji znalezionych w wynikach wyszukiwania; jeśli czegoś nie znajdziesz, wpisz null lub pustą listę i nic nie zgaduj.
Nie podawaj porad medycznych, dawkowania ani twierdzeń o leczeniu; efekty opisuj jako "zwykle opisywane przez użytkowników".
Opis pisz po polsku, w 3-4 zdaniach: pochodzenie/rodzaj, aromat i smak, zwykle opisywane efekty.
Odpowiedz wyłącznie jednym obiektem JSON, bez komentarza i bez znaczników kodu, w formacie:
{"description": string, "kind": "indica"|"sativa"|"hybryda"|null, "thc": number|null, "cbd": number|null, "terpenes": string[], "taste": string, "confidence": "niska"|"średnia"|"wysoka"}`;

// Podpowiedź opisu odmiany z internetu (tylko podgląd: użytkownik sprawdza i zapisuje sam)
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const producer = String(b.producer ?? '').trim().slice(0, 60);
  const name = String(b.name ?? '').trim().slice(0, 80);
  if (!producer || !name) return bad('Podaj producenta i nazwę odmiany.');
  if (!process.env.ANTHROPIC_API_KEY) return bad('Podpowiedzi z internetu nie są jeszcze skonfigurowane (brak klucza API).', 503);

  const key = `${producer.toLowerCase()}|${name.toLowerCase()}`;
  const q = sql();
  const cached = await q`SELECT data FROM strain_suggestions WHERE key = ${key} AND created_at > now() - interval '90 days'`;
  if (cached.length) return NextResponse.json({ ...cached[0].data, cached: true });

  if (!(await hit(`suggest:${user.id}`, 15, 86400))) return bad('Dzienny limit podpowiedzi został wykorzystany. Spróbuj jutro.', 429);

  const terpeneOptions = (await listOptions()).terpene;
  const prompt = `Odmiana: "${name}", producent: "${producer}".\nZnajdź: rodzaj, typowe stężenie THC i CBD (%), dominujące terpeny (wybierz wyłącznie z listy: ${terpeneOptions.join(', ')}), smak i aromat oraz krótki opis.`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 1500, system: SYSTEM,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3, allowed_domains: DOMAINS }],
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) {
    await logError('suggest', new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`), { path: '/api/strains/suggest' });
    return bad('Nie udało się pobrać podpowiedzi. Spróbuj ponownie później.', 502);
  }
  const j = await r.json();
  const blocks = j.content || [];
  const text = blocks.filter((x) => x.type === 'text').map((x) => x.text).join('\n');
  const m = text.match(/\{[\s\S]*\}/);
  let raw;
  try { raw = m ? JSON.parse(m[0]) : null; } catch { raw = null; }
  if (!raw) return bad('Nie znaleziono wiarygodnych informacji o tej odmianie w wybranych serwisach.', 404);

  // źródła: cytowane w tekście, a gdy ich brak, wyniki wyszukiwania
  const found = [];
  const add = (x) => { if (x?.url && /^https?:\/\//.test(x.url) && !found.some((f) => f.url === x.url)) found.push({ title: String(x.title || new URL(x.url).hostname).slice(0, 120), url: x.url }); };
  blocks.filter((x) => x.type === 'text').forEach((x) => (x.citations || []).forEach(add));
  if (!found.length) blocks.filter((x) => x.type === 'web_search_tool_result' && Array.isArray(x.content)).forEach((x) => x.content.forEach(add));

  const num = (v) => (typeof v === 'number' && v >= 0 && v <= 40 ? Math.round(v * 10) / 10 : null);
  const allowed = new Map(terpeneOptions.map((t) => [t.toLowerCase(), t]));
  const suggestion = {
    description: String(raw.description ?? '').trim().slice(0, 900),
    kind: KINDS.some((k) => k.value === raw.kind) ? raw.kind : null,
    thc: num(raw.thc), cbd: num(raw.cbd),
    terpenes: [...new Set((Array.isArray(raw.terpenes) ? raw.terpenes : []).map((t) => allowed.get(String(t).toLowerCase())).filter(Boolean))].slice(0, 6),
    taste: String(raw.taste ?? '').trim().slice(0, 120),
    confidence: ['niska', 'średnia', 'wysoka'].includes(raw.confidence) ? raw.confidence : 'niska',
  };
  if (!suggestion.description) return bad('Nie znaleziono wiarygodnych informacji o tej odmianie w wybranych serwisach.', 404);
  const out = { suggestion, sources: found.slice(0, 4) };
  await q`INSERT INTO strain_suggestions (key, data) VALUES (${key}, ${JSON.stringify(out)}::jsonb)
          ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, created_at = now()`;
  return NextResponse.json({ ...out, cached: false });
});
