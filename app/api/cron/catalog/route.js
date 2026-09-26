import { NextResponse } from 'next/server';
import { bad, safe } from '@/lib/guard';
import { syncCatalog } from '@/lib/catalog';
import { csvToObjects } from '@/lib/csv';

// Automatyczna aktualizacja katalogu. Wywołuje ją Vercel Cron (co tydzień, patrz vercel.json).
// Wymaga zmiennych: CRON_SECRET oraz CATALOG_FEED_URL (adres pliku CSV lub JSON z listą odmian).
export const GET = safe(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return bad('Brak autoryzacji.', 401);
  const url = process.env.CATALOG_FEED_URL;
  if (!url) return bad('Nie ustawiono CATALOG_FEED_URL.', 400);

  const r = await fetch(url, { headers: { 'User-Agent': 'Zielnik/1.0' }, cache: 'no-store' });
  if (!r.ok) return bad(`Źródło zwróciło błąd ${r.status}.`, 502);
  const text = (await r.text()).trim();
  let rows;
  if (text.startsWith('[') || text.startsWith('{')) {
    const j = JSON.parse(text);
    rows = Array.isArray(j) ? j : j.items || [];
  } else rows = csvToObjects(text);
  return NextResponse.json(await syncCatalog(rows, 'automatyczne źródło'));
});
