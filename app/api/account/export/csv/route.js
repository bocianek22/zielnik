import { sql } from '@/lib/db';
import { bad, requireUser, safe } from '@/lib/guard';
import { buildDiaryCsv, csvNum, csvText } from '@/lib/csv-export';
import { methodLabel, periodLabel } from '@/lib/usage-meta';
import { DISCREET_COOKIE } from '@/lib/discreet';
import { decryptField, rowScope } from '@/lib/data-crypto';
import { batchSummary } from '@/lib/batch-meta';

const TYPES = { objawy: 'Objawy', zuzycie: 'Zużycie', zakupy: 'Zakupy' };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Dziennik zalogowanego użytkownika jako jeden plik CSV z kolumną „Typ” (objawy dzienne z pomiarami, zużycie, zakupy).
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
    // własne objawy (POM-07) i własne pomiary (POM-63) w kolumnach „Nazwa: wartość; ...”; dzień tylko z nimi też dostaje wiersz.
    // Pomiar z przecinkiem dziesiętnym i jednostką („Waga: 74,6 kg”), jak w polskim Excelu.
    for (const r of await q`WITH cv AS (SELECT v.day, string_agg(c.name || ': ' || v.value, '; ' ORDER BY c.slot) AS txt
          FROM symptom_values v JOIN symptom_custom c ON c.id = v.custom_id WHERE v.user_id = ${me}::int GROUP BY v.day),
        mv AS (SELECT v.day, string_agg(d.name || ': ' || replace((v.value::float8)::text, '.', ',') || CASE WHEN d.unit <> '' THEN ' ' || d.unit ELSE '' END, '; ' ORDER BY d.slot) AS txt
          FROM measure_values v JOIN measure_defs d ON d.id = v.def_id WHERE v.user_id = ${me}::int GROUP BY v.day),
        l AS (SELECT day, pain, sleep, anxiety, mood, note FROM symptom_log WHERE user_id = ${me}::int),
        days AS (SELECT day FROM l UNION SELECT day FROM cv UNION SELECT day FROM mv)
      SELECT to_char(days.day, 'YYYY-MM-DD') AS d, l.pain, l.sleep, l.anxiety, l.mood, COALESCE(l.note, '') AS note, cv.txt AS custom, mv.txt AS measures
      FROM days LEFT JOIN l ON l.day = days.day LEFT JOIN cv ON cv.day = days.day LEFT JOIN mv ON mv.day = days.day
      WHERE (${from}::date IS NULL OR days.day >= ${from}::date) AND (${to}::date IS NULL OR days.day <= ${to}::date)`) {
      rows.push({ k: `${r.d} 99:99`, cells: [TYPES.objawy, r.d, '', '', '', '', '', '', '', r.pain, r.sleep, r.anxiety, r.mood, csvText(decryptField('symptom_log', 'note', rowScope('symptom_log', { user_id: me, day: r.d }), r.note)), csvText(r.custom), csvText(r.measures)] });
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
          strain_name AS name, grams::float8 AS grams, COALESCE(strain_unit(strain_id), 'g') AS unit, cost::float8 AS cost,
          id, batch_no AS "batchNo", to_char(batch_expires_on, 'YYYY-MM-DD') AS "batchExpires", batch_effect AS "batchEffect", batch_note
        FROM purchases
        WHERE user_id = ${me} AND (${from}::date IS NULL OR (created_at AT TIME ZONE 'Europe/Warsaw')::date >= ${from}::date)
          AND (${to}::date IS NULL OR (created_at AT TIME ZONE 'Europe/Warsaw')::date <= ${to}::date)`) {
      // partia (POM-32) w kolumnie „Notatka”: numer, ważność, ocena i notatka (odszyfrowana) w jednej linii
      const batch = batchSummary({ ...r, batchNote: decryptField('purchases', 'batch_note', rowScope('purchases', { user_id: me, id: r.id }), r.batch_note) });
      rows.push({ k: `${r.d} ${r.t}`, cells: [TYPES.zakupy, r.d, r.t, csvText(r.name), csvNum(r.grams), r.unit, '', '', csvNum(r.cost), '', '', '', '', csvText(batch)] });
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
