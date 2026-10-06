import { sql } from '@/lib/db';
import { bad, requireUser, safe } from '@/lib/guard';
import { buildDiaryCsv, csvNum, csvText } from '@/lib/csv-export';
import { methodLabel, periodLabel } from '@/lib/usage-meta';
import { DISCREET_COOKIE } from '@/lib/discreet';

const TYPES = { objawy: 'Objawy', zuzycie: 'Zużycie', zakupy: 'Zakupy' };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Dziennik zalogowanego użytkownika jako jeden plik CSV z kolumną „Typ” (objawy dzienne, zużycie, zakupy).
// ?typ=objawy|zuzycie|zakupy (domyślnie wszystko), ?od=RRRR-MM-DD, ?do=RRRR-MM-DD (czas polski). Tylko własne dane.
export const GET = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const p = new URL(req.url).searchParams;
  const typ = p.get('typ');
  if (typ && !TYPES[typ]) return bad('Nieznany typ danych.');
  const from = p.get('od') || null, to = p.get('do') || null;
  const okDay = (v) => !v || (DAY.test(v) && !Number.isNaN(Date.parse(v)) && new Date(`${v}T12:00:00Z`).toISOString().startsWith(v));
  if (!okDay(from) || !okDay(to)) return bad('Data musi mieć postać RRRR-MM-DD.');
  if (from && to && from > to) return bad('Data „od” jest późniejsza niż „do”.');
  const want = (k) => !typ || typ === k;
  const q = sql();
  const me = user.id;
  const rows = []; // { k: klucz sortowania, cells }
  if (want('objawy')) {
    // własne objawy (POM-07) w jednej kolumnie „Nazwa: wartość; ...”; dzień tylko z własnymi objawami też dostaje wiersz
    for (const r of await q`WITH cv AS (SELECT v.day, string_agg(c.name || ': ' || v.value, '; ' ORDER BY c.slot) AS txt
          FROM symptom_values v JOIN symptom_custom c ON c.id = v.custom_id WHERE v.user_id = ${me}::int GROUP BY v.day),
        l AS (SELECT day, pain, sleep, anxiety, mood, note FROM symptom_log WHERE user_id = ${me}::int)
      SELECT to_char(COALESCE(l.day, cv.day), 'YYYY-MM-DD') AS d, l.pain, l.sleep, l.anxiety, l.mood, COALESCE(l.note, '') AS note, cv.txt AS custom
      FROM l FULL JOIN cv ON cv.day = l.day
      WHERE (${from}::date IS NULL OR COALESCE(l.day, cv.day) >= ${from}::date) AND (${to}::date IS NULL OR COALESCE(l.day, cv.day) <= ${to}::date)`) {
      rows.push({ k: `${r.d} 99:99`, cells: [TYPES.objawy, r.d, '', '', '', '', '', '', '', r.pain, r.sleep, r.anxiety, r.mood, csvText(r.note), csvText(r.custom)] });
    }
  }
  if (want('zuzycie')) {
    for (const r of await q`SELECT to_char(l.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS d, to_char(l.created_at AT TIME ZONE 'Europe/Warsaw', 'HH24:MI') AS t,
          s.name, l.grams::float8 AS grams, form_unit(s.form) AS unit, l.method, usage_period(l.period, l.created_at) AS period
        FROM usage_log l JOIN strains s ON s.id = l.strain_id
        WHERE l.user_id = ${me} AND (${from}::date IS NULL OR (l.created_at AT TIME ZONE 'Europe/Warsaw')::date >= ${from}::date)
          AND (${to}::date IS NULL OR (l.created_at AT TIME ZONE 'Europe/Warsaw')::date <= ${to}::date)`) {
      rows.push({ k: `${r.d} ${r.t}`, cells: [TYPES.zuzycie, r.d, r.t, csvText(r.name), csvNum(r.grams), r.unit, methodLabel(r.method) ?? '', periodLabel(r.period) ?? ''] });
    }
    // dni oznaczone jako bez zużycia (POM-38): osobny typ wiersza, bez ilości
    for (const r of await q`SELECT to_char(day, 'YYYY-MM-DD') AS d FROM no_use_days
        WHERE user_id = ${me}::int AND (${from}::date IS NULL OR day >= ${from}::date) AND (${to}::date IS NULL OR day <= ${to}::date)`) {
      rows.push({ k: `${r.d} 00:00`, cells: ['Bez zużycia', r.d] });
    }
  }
  if (want('zakupy')) {
    for (const r of await q`SELECT to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS d, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'HH24:MI') AS t,
          strain_name AS name, grams::float8 AS grams, COALESCE(strain_unit(strain_id), 'g') AS unit, cost::float8 AS cost
        FROM purchases
        WHERE user_id = ${me} AND (${from}::date IS NULL OR (created_at AT TIME ZONE 'Europe/Warsaw')::date >= ${from}::date)
          AND (${to}::date IS NULL OR (created_at AT TIME ZONE 'Europe/Warsaw')::date <= ${to}::date)`) {
      rows.push({ k: `${r.d} ${r.t}`, cells: [TYPES.zakupy, r.d, r.t, csvText(r.name), csvNum(r.grams), r.unit, '', '', csvNum(r.cost)] });
    }
  }
  rows.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0)); // sort stabilny: w obrębie czasu zostaje kolejność objawy, zużycie, zakupy
  // tryb dyskretny (ciasteczko tego urządzenia): nazwa pliku bez nazwy aplikacji i słów o konopiach
  const discreet = (req.headers.get('cookie') || '').split(/;\s*/).includes(`${DISCREET_COOKIE}=1`);
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
  const name = `${discreet ? 'notatnik' : 'zielnik-dziennik'}-${today}.csv`;
  return new Response(buildDiaryCsv(rows.map((r) => r.cells)), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' },
  });
});
