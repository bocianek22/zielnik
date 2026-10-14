import { ensureDb, sql } from './db';
import { SYMPTOMS } from './symptoms';
import { listCustom } from './symptoms-custom';
import { MIN_DAYS, normPeriod } from './observations';

// Wzorce wg dnia tygodnia (POM-54): średnia każdego objawu w poniedziałki, wtorki… z ostatnich `period` dni.
// Tylko właściciel, dni w czasie polskim (kolumna `day` już jest dniem polskim), stała kolejność Pn–Nd, średnia od
// MIN_DAYS dni w komórce (poniżej tylko liczba dni). Nie łączy się z zużyciem, więc działa też bez zapisów zużycia.
// Sen przypisujemy do dnia wpisu (noc przed nim), bez przesuwania jak w obserwacjach odmian.
const round1 = (n) => Math.round(n * 10) / 10;

export async function weekdayObservations(userId, period) {
  await ensureDb();
  const q = sql();
  const u = Number(userId) || 0;
  const days = normPeriod(period);
  const [rows, custom] = await Promise.all([
    q`WITH win AS (SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date - ${days - 1}::int AS s, (now() AT TIME ZONE 'Europe/Warsaw')::date AS e),
      vals AS (
        SELECT k.key, k.val, s.day
        FROM symptom_log s, win,
          LATERAL (VALUES ('pain', s.pain), ('sleep', s.sleep), ('anxiety', s.anxiety), ('mood', s.mood)) AS k(key, val)
        WHERE s.user_id = ${u} AND s.day BETWEEN win.s AND win.e AND k.val IS NOT NULL
        UNION ALL
        SELECT 'c' || v.custom_id::text, v.value, v.day FROM symptom_values v, win
        WHERE v.user_id = ${u} AND v.day BETWEEN win.s AND win.e
      )
      SELECT key, EXTRACT(ISODOW FROM day)::int AS dow, COUNT(*)::int AS days, AVG(val)::float8 AS avg
      FROM vals GROUP BY 1, 2`,
    listCustom(u),
  ]);
  const meta = [...SYMPTOMS.map((s) => ({ key: s.key, label: s.label })), ...custom.map((d) => ({ key: `c${d.id}`, label: d.name, custom: true }))];
  const cell = (r) => (r && r.days >= MIN_DAYS ? { days: r.days, avg: round1(r.avg) } : { days: r ? r.days : 0, avg: null });
  return {
    period: days,
    minDays: MIN_DAYS,
    symptoms: meta.map((m) => ({ ...m, days: [1, 2, 3, 4, 5, 6, 7].map((dow) => cell(rows.find((r) => r.key === m.key && r.dow === dow))) }))
      .filter((s) => s.days.some((c) => c.days > 0)),
  };
}
