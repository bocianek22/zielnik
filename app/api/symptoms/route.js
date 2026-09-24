import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { parseNumber } from '@/lib/strains';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FIELDS = ['pain', 'sleep', 'anxiety', 'mood'];

async function load(me, days = 60) {
  const q = sql();
  const rows = await q`SELECT to_char(day, 'YYYY-MM-DD') AS day, pain, sleep, anxiety, mood, note FROM symptom_log
                       WHERE user_id = ${me}::int AND day >= (now() AT TIME ZONE 'Europe/Warsaw')::date - ${days}::int ORDER BY day`;
  const usage = await q`SELECT to_char((created_at AT TIME ZONE 'Europe/Warsaw')::date, 'YYYY-MM-DD') AS day, SUM(grams)::float8 AS grams
                        FROM usage_log WHERE user_id = ${me}::int AND (created_at AT TIME ZONE 'Europe/Warsaw')::date >= (now() AT TIME ZONE 'Europe/Warsaw')::date - ${days}::int
                        GROUP BY 1 ORDER BY 1`;
  return { rows, usage };
}

export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json(await load(user.id));
});

// { day, pain, sleep, anxiety, mood, note } - zapis (lub nadpisanie) wpisu dnia
export const PUT = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const day = String(b.day ?? '');
  if (!DATE.test(day) || Number.isNaN(Date.parse(day)) || Date.parse(day) > Date.now() + 864e5) return bad('Nieprawidłowa data.');
  const v = {};
  for (const f of FIELDS) {
    const n = parseNumber(b[f], 0, 10);
    if (Number.isNaN(n)) return bad('Wartości muszą być z zakresu 0–10.');
    v[f] = n == null ? null : Math.round(n);
  }
  await sql()`INSERT INTO symptom_log (user_id, day, pain, sleep, anxiety, mood, note)
              VALUES (${user.id}, ${day}::date, ${v.pain}, ${v.sleep}, ${v.anxiety}, ${v.mood}, ${String(b.note ?? '').trim().slice(0, 500)})
              ON CONFLICT (user_id, day) DO UPDATE SET pain = EXCLUDED.pain, sleep = EXCLUDED.sleep, anxiety = EXCLUDED.anxiety,
                mood = EXCLUDED.mood, note = EXCLUDED.note, updated_at = now()`;
  return NextResponse.json(await load(user.id));
});

export const DELETE = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const { day } = await req.json().catch(() => ({}));
  await sql()`DELETE FROM symptom_log WHERE user_id = ${user.id} AND day = ${String(day)}::date`;
  return NextResponse.json(await load(user.id));
});
