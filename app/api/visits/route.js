import { NextResponse } from 'next/server';
import { requireUser, bad, safe, jsonBody } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { listVisits, addVisit } from '@/lib/visits';
import { savePrefs, parsePrefs, getPrefs } from '@/lib/push';

export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ visits: await listVisits(user.id) });
});

// { day, note, nextVisit? } - nowa wizyta; nextVisit (RRRR-MM-DD) ustawia też datę następnej wizyty w przypomnieniach
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!(await hit(`visit-new:${user.id}`, 60, 3600))) return bad('Zbyt wiele zapisów. Spróbuj ponownie później.', 429);
  const b = await jsonBody(req);
  // następna wizyta: ta sama walidacja co w profilu (bez dat z przeszłości) i po dniu tej wizyty; sprawdzana przed zapisem
  const next = b.nextVisit == null || b.nextVisit === '' ? null : String(b.nextVisit);
  const parsed = next ? parsePrefs({ nextVisit: next }) : null;
  if (parsed?.error) return bad(parsed.error);
  const prefs = parsed?.prefs;
  if (next && next <= String(b.day ?? '')) return bad('Następna wizyta musi być po dniu tej wizyty.');
  const out = await addVisit(user.id, b);
  if (out.error) return bad(out.error, out.status);
  if (prefs) await savePrefs(user.id, prefs);
  // notifyVisit: czy przypomnienie o wizycie jest włączone (klient podpowiada, gdzie je włączyć)
  return NextResponse.json({ visit: out.visit, visits: await listVisits(user.id), ...(prefs && { notifyVisit: (await getPrefs(user.id)).notifyVisit }) });
});
