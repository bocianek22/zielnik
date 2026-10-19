import { bad, requireUser, safe } from '@/lib/guard';
import { buildIcs, ICS_KINDS } from '@/lib/ics';
import { DISCREET_COOKIE } from '@/lib/discreet';
import { todayPL, addDaysIso } from '@/lib/date';

// Wydarzenie do kalendarza telefonu (plan wykupu, nowa recepta, wizyta): ?typ=wykup|recepta|wizyta&dzien=RRRR-MM-DD.
// Bez danych z bazy: dzień przychodzi z karty, a tytuł jest stały (w trybie dyskretnym neutralny).
export const GET = safe(async (req) => {
  const { res } = await requireUser();
  if (res) return res;
  const p = new URL(req.url).searchParams;
  const kind = p.get('typ'), day = p.get('dzien') || '';
  const today = todayPL();
  // tylko przyszłe daty w rozsądnym zakresie (dziś do roku naprzód)
  if (!ICS_KINDS[kind] || !(day >= today && day <= addDaysIso(today, 366))) return bad('Nieprawidłowe dane wydarzenia.');
  const discreet = (req.headers.get('cookie') || '').split(/;\s*/).includes(`${DISCREET_COOKIE}=1`);
  const ics = buildIcs({ kind, day, discreet });
  if (!ics) return bad('Nieprawidłowe dane wydarzenia.');
  const name = `${discreet ? 'przypomnienie' : ICS_KINDS[kind].file}-${day}.ics`;
  return new Response(ics, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' },
  });
});
