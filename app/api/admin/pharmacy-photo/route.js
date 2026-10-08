import { NextResponse } from 'next/server';
import { ensureDb, sql } from '@/lib/db';
import { requireAdmin, bad, safe, jsonBody } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { logError } from '@/lib/errorlog';
import { logAudit } from '@/lib/audit';
import { DEFAULT_VISION_MODEL, MAX_TOTAL_BYTES, extractRows, validateImages } from '@/lib/pharmacy-ocr';
import catalog from '@/data/odmiany.json';

export const maxDuration = 60;

const model = () => process.env.ZIELNIK_VISION_MODEL || DEFAULT_VISION_MODEL;

// Czy odczyt jest skonfigurowany (bez ujawniania klucza)
export const GET = safe(async () => {
  const { res } = await requireAdmin();
  if (res) return res;
  return NextResponse.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY), model: model() });
});

// Zdjęcie listy lub półki apteki -> wiersze do podglądu. Zdjęcie nie jest zapisywane ani logowane.
export const POST = safe(async (req) => {
  const { user, res } = await requireAdmin();
  if (res) return res;
  if (!process.env.ANTHROPIC_API_KEY) return bad('Odczyt zdjęć nie jest skonfigurowany: ustaw ANTHROPIC_API_KEY w zmiennych Vercel.', 503);
  if (Number(req.headers.get('content-length') || 0) > MAX_TOTAL_BYTES * 1.4) return bad('Zdjęcia są razem za duże. Wyślij mniej naraz.', 413);
  const { images: list } = await jsonBody(req);
  const { images, error } = validateImages(list);
  if (error) return bad(error);
  if (!(await hit(`pharmacy-photo:${user.id}`, 40, 86400))) return bad('Dzienny limit odczytów zdjęć został wykorzystany. Spróbuj jutro.', 429);

  const out = await extractRows({ images, apiKey: process.env.ANTHROPIC_API_KEY, model: model(), reference: catalog.strains });
  if (out.error) {
    if (out.log) await logError('pharmacy-photo', new Error(out.log), { path: '/api/admin/pharmacy-photo' });
    return bad(out.error, out.status || 502);
  }
  // „istnieje”: ten sam klucz co w katalogu (producent + nazwa, bez wielkości liter)
  await ensureDb();
  const key = (p, n) => `${p.toLowerCase()}|${n.toLowerCase()}`;
  const have = new Set((await sql()`SELECT producer, name FROM market_catalog`).map((r) => key(r.producer, r.name)));
  const rows = out.rows.map((r) => ({ ...r, exists: have.has(key(r.producer, r.name)) }));
  await logAudit(user.username, 'odczytał zdjęcie z apteki', null, `zdjęć ${images.length}, pozycji ${rows.length}`);
  return NextResponse.json({ rows, model: model() });
});
