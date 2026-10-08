import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { KINDS, BODY_MAX, HOURLY_LIMIT, cleanMeta, notifyFeedback } from '@/lib/feedback';

const own = (uid) => sql()`SELECT id, kind, body, status, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS at FROM beta_feedback WHERE user_id = ${uid} ORDER BY created_at DESC, id DESC LIMIT 50`;

// Własne zgłoszenia ze statusem (notatka admina zostaje po jego stronie)
export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ items: await own(user.id) });
});

// { kind, body, meta? }
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  if (!KINDS.includes(b.kind)) return bad('Wybierz rodzaj uwagi.');
  const body = String(b.body ?? '').trim();
  if (!body) return bad('Opisz krótko, o co chodzi.');
  if (body.length > BODY_MAX) return bad(`Opis może mieć najwyżej ${BODY_MAX} znaków.`);
  if (!(await hit(`feedback:${user.id}`, HOURLY_LIMIT, 3600))) return bad('Zbyt wiele zgłoszeń w ciągu godziny. Spróbuj ponownie później.', 429);
  const [row] = await sql()`INSERT INTO beta_feedback (user_id, kind, body, meta) VALUES (${user.id}, ${b.kind}, ${body}, ${JSON.stringify(cleanMeta(b.meta))}::jsonb) RETURNING id`;
  notifyFeedback(row.id, b.kind);
  return NextResponse.json({ ok: true, id: row.id, items: await own(user.id) });
});
