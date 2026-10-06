import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { parseNumber } from '@/lib/strains';
import { otherAccount, OTHER_ACCOUNT_MSG, intId } from '@/lib/ids';
import { listCustom, customValues } from '@/lib/symptoms-custom';
import { CUSTOM_MAX } from '@/lib/symptoms';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FIELDS = ['pain', 'sleep', 'anxiety', 'mood'];

async function load(me, days = 60) {
  const q = sql();
  const rows = await q`SELECT to_char(day, 'YYYY-MM-DD') AS day, pain, sleep, anxiety, mood, note FROM symptom_log
                       WHERE user_id = ${me}::int AND day >= (now() AT TIME ZONE 'Europe/Warsaw')::date - ${days}::int ORDER BY day`;
  // zużycie dzienne: gramy (susz) i ml (olej, pen) osobno
  const usage = await q`SELECT to_char((l.created_at AT TIME ZONE 'Europe/Warsaw')::date, 'YYYY-MM-DD') AS day,
                               COALESCE(SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'g'), 0)::float8 AS grams,
                               COALESCE(SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'ml'), 0)::float8 AS ml
                        FROM usage_log l JOIN strains s ON s.id = l.strain_id
                        WHERE l.user_id = ${me}::int AND (l.created_at AT TIME ZONE 'Europe/Warsaw')::date >= (now() AT TIME ZONE 'Europe/Warsaw')::date - ${days}::int
                        GROUP BY 1 ORDER BY 1`;
  // własne objawy (POM-07): definicje i wartości (osobno od wierszy, bo dzień może mieć tylko własne)
  const [custom, customVals] = await Promise.all([listCustom(me), customValues(me, days)]);
  return { rows, usage, custom, customValues: customVals };
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
  if (otherAccount(b, user)) return bad(OTHER_ACCOUNT_MSG, 409); // zapis z kolejki offline innego konta
  const day = String(b.day ?? '');
  if (!DATE.test(day) || Number.isNaN(Date.parse(day)) || Date.parse(day) > Date.now() + 864e5) return bad('Nieprawidłowa data.');
  const v = {};
  for (const f of FIELDS) {
    const n = parseNumber(b[f], 0, 10);
    if (Number.isNaN(n)) return bad('Wartości muszą być z zakresu 0–10.');
    v[f] = n == null ? null : Math.round(n);
  }
  // { custom: { <id>: 0-10 | null } } - wartości własnych objawów tego dnia (null/'' kasuje); bez pola `custom` zostają bez zmian
  let cv = null;
  if (b.custom && typeof b.custom === 'object' && !Array.isArray(b.custom)) {
    const byId = new Map(); // "1" i "01" to ten sam objaw: jeden wiersz na id (inaczej ON CONFLICT trafia dwa razy)
    for (const [k, raw] of Object.entries(b.custom).slice(0, CUSTOM_MAX * 4)) {
      const id = intId(k);
      const n = parseNumber(raw, 0, 10);
      if (!id || Number.isNaN(n)) return bad('Wartości muszą być z zakresu 0–10.');
      byId.set(id, n == null ? null : Math.round(n));
    }
    cv = [...byId].map(([id, v]) => ({ id, v }));
  }
  const q = sql();
  const ops = [];
  if (cv?.length) {
    // jedno polecenie: cudze i nieistniejące identyfikatory odpadają na złączeniu z symptom_custom
    ops.push(q`WITH inp AS (SELECT x.id, x.v FROM jsonb_to_recordset(${JSON.stringify(cv)}::jsonb) AS x(id int, v int)
                         JOIN symptom_custom c ON c.id = x.id AND c.user_id = ${user.id}::int),
      del AS (DELETE FROM symptom_values sv USING inp WHERE sv.custom_id = inp.id AND sv.day = ${day}::date AND inp.v IS NULL)
      INSERT INTO symptom_values (custom_id, user_id, day, value)
      SELECT id, ${user.id}::int, ${day}::date, v FROM inp WHERE v IS NOT NULL
      ON CONFLICT (custom_id, day) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`);
  }
  // obie tabele w jednej transakcji: bez zapisu częściowego
  ops.push(q`INSERT INTO symptom_log (user_id, day, pain, sleep, anxiety, mood, note)
              VALUES (${user.id}, ${day}::date, ${v.pain}, ${v.sleep}, ${v.anxiety}, ${v.mood}, ${String(b.note ?? '').trim().slice(0, 500)})
              ON CONFLICT (user_id, day) DO UPDATE SET pain = EXCLUDED.pain, sleep = EXCLUDED.sleep, anxiety = EXCLUDED.anxiety,
                mood = EXCLUDED.mood, note = EXCLUDED.note, updated_at = now()`);
  await q.transaction(ops);
  return NextResponse.json(await load(user.id));
});

export const DELETE = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const day = String((await req.json().catch(() => ({}))).day ?? '');
  if (!DATE.test(day) || Number.isNaN(Date.parse(day))) return bad('Nieprawidłowa data.');
  const q = sql();
  await q.transaction([
    q`DELETE FROM symptom_values WHERE user_id = ${user.id}::int AND day = ${day}::date`,
    q`DELETE FROM symptom_log WHERE user_id = ${user.id} AND day = ${day}::date`,
  ]);
  return NextResponse.json(await load(user.id));
});
