import { sql, ensureDb } from './db';
import { CAL_DAYS } from './usage-calendar';
import { listCustom } from './symptoms-custom';

// „Rok objawów” (POM-50): wartości objawów dzień po dniu z ostatnich CAL_DAYS dni (czas polski), tylko własne dane.
// { today, from, rows: [{ day, pain, sleep, anxiety, mood, c<id>... }], custom: [{ id, name }] }; dni bez wpisu pomijamy.
export async function symptomCalendar(userId, days = CAL_DAYS) {
  await ensureDb();
  const q = sql();
  const u = Number(userId) || 0;
  const span = Math.max(1, Math.min(CAL_DAYS, Math.floor(days)));
  const [t] = await q`SELECT to_char((now() AT TIME ZONE 'Europe/Warsaw')::date, 'YYYY-MM-DD') AS today,
    to_char((now() AT TIME ZONE 'Europe/Warsaw')::date - ${span - 1}::int, 'YYYY-MM-DD') AS from`;
  const [rows, vals, custom] = await Promise.all([
    q`SELECT to_char(day, 'YYYY-MM-DD') AS day, pain, sleep, anxiety, mood FROM symptom_log
      WHERE user_id = ${u} AND day BETWEEN ${t.from}::date AND ${t.today}::date
        AND (pain IS NOT NULL OR sleep IS NOT NULL OR anxiety IS NOT NULL OR mood IS NOT NULL) ORDER BY day`,
    q`SELECT to_char(day, 'YYYY-MM-DD') AS day, custom_id AS id, value FROM symptom_values
      WHERE user_id = ${u} AND day BETWEEN ${t.from}::date AND ${t.today}::date`,
    listCustom(u),
  ]);
  const m = new Map(rows.map((r) => [r.day, { ...r }]));
  for (const v of vals) { const r = m.get(v.day) ?? { day: v.day }; r[`c${v.id}`] = v.value; m.set(v.day, r); }
  return { today: t.today, from: t.from, rows: [...m.values()].sort((a, b) => a.day.localeCompare(b.day)), custom: custom.map((c) => ({ id: c.id, name: c.name })) };
}
