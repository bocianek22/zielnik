import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, jsonBody } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { logError } from '@/lib/errorlog';
import { listOptions } from '@/lib/strains';
import { buildRequest, parseResponse, usageOf } from '@/lib/strain-suggest';

export const maxDuration = 60;

const DOMAINS = (process.env.SUGGEST_DOMAINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const NOT_FOUND = 'Nie znaleziono w internecie wiarygodnych informacji o tej odmianie. Uzupełnij pola ręcznie (np. z ulotki lub strony producenta).';

// Podpowiedź opisu odmiany z internetu (tylko podgląd: użytkownik sprawdza i zapisuje sam)
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await jsonBody(req);
  const producer = String(b.producer ?? '').trim().slice(0, 60);
  const name = String(b.name ?? '').trim().slice(0, 80);
  if (!producer || !name) return bad('Podaj producenta i nazwę odmiany.');
  if (!process.env.ANTHROPIC_API_KEY) return bad('Podpowiedzi z internetu nie są jeszcze skonfigurowane (brak klucza API).', 503);

  const key = `${producer.toLowerCase()}|${name.toLowerCase()}`;
  const q = sql();
  // zapamiętany wynik 90 dni, „nie znaleziono” 7 dni: ponowne próby nie kosztują
  const cached = await q`SELECT data FROM strain_suggestions WHERE key = ${key}
                          AND created_at > now() - CASE WHEN data->>'notFound' IS NOT NULL THEN interval '7 days' ELSE interval '90 days' END`;
  if (cached.length) return cached[0].data.notFound ? bad(NOT_FOUND, 404) : NextResponse.json({ ...cached[0].data, cached: true });

  if (!(await hit(`suggest:${user.id}`, 15, 86400))) return bad('Dzienny limit podpowiedzi został wykorzystany. Spróbuj jutro.', 429);

  const terpeneOptions = (await listOptions()).terpene;
  const body = buildRequest({ producer, name, terpeneOptions, domains: DOMAINS });
  const call = async (extra = {}) => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, ...extra }),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };

  const blocks = [];
  const used = { searches: 0, input: 0, output: 0, calls: 0 };
  const take = (j) => { blocks.push(...(j.content || [])); const u = usageOf(j); for (const k of ['searches', 'input', 'output']) used[k] += u[k]; used.calls++; return j; };
  try {
    let j = take(await call());
    // długie wyszukiwanie: API przerywa turę (pause_turn), wznawiamy z dotychczasową treścią
    for (let i = 0; j.stop_reason === 'pause_turn' && i < 2; i++) {
      j = take(await call({ messages: [...body.messages, { role: 'assistant', content: blocks }] }));
    }
    // były wyniki, ale model nie oddał karty: jedna prośba z wymuszonym narzędziem (bez nowych wyszukiwań)
    if (used.searches && !blocks.some((x) => x.type === 'tool_use' && x.name === 'karta_odmiany') && j.stop_reason !== 'tool_use') {
      take(await call({
        messages: [...body.messages, { role: 'assistant', content: blocks }, { role: 'user', content: 'Wywołaj teraz karta_odmiany na podstawie znalezionych wyników.' }],
        tool_choice: { type: 'tool', name: 'karta_odmiany' },
      }));
    }
  } catch (e) {
    await logError('suggest', e, { path: '/api/strains/suggest' });
    return bad('Nie udało się pobrać podpowiedzi. Spróbuj ponownie później.', 502);
  }

  const out = parseResponse(blocks, terpeneOptions);
  console.log(`suggest: ${out ? 'ok' : 'brak'}, wywołania ${used.calls}, wyszukiwania ${used.searches}, tokeny ${used.input}/${used.output}`);
  await q`INSERT INTO strain_suggestions (key, data) VALUES (${key}, ${JSON.stringify(out || { notFound: true })}::jsonb)
          ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, created_at = now()`;
  if (!out) return bad(NOT_FOUND, 404);
  return NextResponse.json({ ...out, cached: false });
});
