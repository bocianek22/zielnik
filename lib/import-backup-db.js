// POM-41: zapis zaimportowanej kopii na konto użytkownika (walidacja: lib/import-backup.js).
//
// Zasady:
// - Wszystko w JEDNEJ transakcji (q.transaction, jak usunięcie konta): albo wchodzi całość, albo nic. Wybór wynika z tego, że
//   Neon po HTTP nie ma interaktywnych transakcji, a porcje dawałyby częściowy import, którego użytkownik nie umiałby ocenić.
//   Rozmiar chroni limit pliku (5 MB) i górne granice sekcji. Odczyty (dopasowanie odmian, istniejące wiersze) robimy PRZED
//   transakcją; zapis dodatkowo zabezpieczają ON CONFLICT DO NOTHING i złączenia (odmiana usunięta w międzyczasie odpada).
// - Identyfikatory z pliku nie trafiają do bazy. Nowe id (recepty, testy) pochodzą z sekwencji (potrzebne do AAD notatek),
//   stare id recept służą tylko do mapowania w pamięci (zakup -> nowa recepta).
// - Odmiany: dopasowanie po (nazwa, producent) bez rozróżniania wielkości liter; przy kilku takich samych wygrywa najniższe id.
//   Wpisy z eksportu zużycia, zakupów i testów (starsze pliki bez producenta) łączymy po samej nazwie, tylko gdy jest jednoznaczna.
//   Odmian spoza katalogu NIE tworzymy: wiersze zgłaszamy jako „brak w katalogu”.
// - Duplikaty: wiersze bez klucza unikalnego (zużycie, zakupy, testy, recepty, punkty do omówienia) porównujemy po kluczu
//   naturalnym z krotnością (ten sam plik po raz drugi nic nie dodaje; dwa takie same wiersze w pliku przy jednym w bazie
//   dodają jeden). Czasy porównujemy co do milisekundy (tyle niesie eksport JSON). Istniejących wierszy nie nadpisujemy nigdy.
//   Ryzyko: dwa równoległe importy tego samego pliku mogą wyprzedzić odczyt; chroni limit prób i blokada przycisku w UI.
// - Widoczność: wpisy odmian i testy zawsze 'me', niezależnie od pliku.
// - Historia (zużycie, zakupy) trafia wprost do tabel: bez zmiany stanu i puli (stan pochodzi tylko z wpisów odmian) i bez
//   request_id / stock_delta / pool_delta, więc „Cofnij” nie dotyka zaimportowanych wierszy.
import { sql } from './db';
import { planNote, rowScope } from './data-crypto';
import { CUSTOM_MAX } from './symptoms';
import { unitOf } from './units';
import { normalizeBackup, NOTES_MAX, CAPS } from './import-backup';
import { HttpError } from './guard';

const LABELS = {
  entries: 'Odmiany z ocenami, stanem i notatkami', pool: 'Do wykupienia', usage: 'Zużycie', purchases: 'Zakupy', tests: 'Testy',
  prescriptions: 'Recepty', symptoms: 'Samopoczucie (dziennik)', custom: 'Własne objawy', customValues: 'Wartości własnych objawów',
  doctorNotes: 'Do omówienia z lekarzem', noUse: 'Dni bez zużycia', prefs: 'Ustawienia przypomnień',
};
const ORDER = Object.keys(LABELS);

const cnt = () => ({ added: 0, existing: 0, missing: 0, invalid: 0, limit: 0 });
const ms = (iso) => Date.parse(iso);
const g2 = (n) => Number(n).toFixed(2);
const j = JSON.stringify;

// Multizbiór kluczy istniejących wierszy: key -> lista id (kolejność zachowana). take(key) zużywa jeden istniejący wiersz.
function multiset(rows, keyFn) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r); (m.get(k) ?? m.set(k, []).get(k)).push(r.id ?? null); }
  return { take: (k) => { const l = m.get(k); return l?.length ? { id: l.shift() } : null; } };
}

export async function importBackup(userId, data, { dryRun = false, now = Date.now() } = {}) {
  const n = normalizeBackup(data, now);
  if (n.error) return { error: n.error };
  const { s } = n;
  const q = sql();
  const me = userId;
  const res = Object.fromEntries(ORDER.map((k) => [k, cnt()]));
  for (const [k, v] of Object.entries(n.invalid)) res[k].invalid += v;
  for (const [k, v] of Object.entries(n.limit)) res[k].limit += v;
  const unmatched = new Map(); // nazwa -> powód (do 20 w odpowiedzi)
  const notes = [];
  let noteUnavailable = 0;

  // --- dopasowanie odmian (jedno zapytanie na wszystkie pary z pliku) ---
  const refs = new Map();
  const addRef = (name, producer) => refs.set(`${name}\u0000${producer ?? ''}`, { n: name, p: producer ?? null });
  for (const k of ['entries', 'usage', 'purchases', 'tests']) for (const r of s[k]) addRef(r.name, r.producer);
  const found = new Map();
  if (refs.size) {
    const rows = await q`SELECT x.n, x.p, s.id, s.name, s.form FROM jsonb_to_recordset(${j([...refs.values()])}::jsonb) AS x(n text, p text)
      JOIN strains s ON lower(trim(s.name)) = lower(trim(x.n)) AND (x.p IS NULL OR lower(trim(s.producer)) = lower(trim(x.p))) ORDER BY s.id`;
    for (const r of rows) {
      const k = `${r.n}\u0000${r.p ?? ''}`;
      (found.get(k) ?? found.set(k, []).get(k)).push({ id: r.id, name: r.name, form: r.form });
    }
  }
  // nazwa (małe litery) -> id odmian dopasowanych po (nazwa, producent) z wpisów: podpowiedź dla wierszy bez producenta
  const hint = new Map();
  for (const r of s.entries) {
    const f = found.get(`${r.name}\u0000${r.producer}`)?.[0];
    if (f) (hint.get(r.name.toLowerCase()) ?? hint.set(r.name.toLowerCase(), new Set()).get(r.name.toLowerCase())).add(f.id);
  }
  // zwraca odmianę albo null (zapisując powód w `unmatched`)
  const resolve = (r) => {
    const list = found.get(`${r.name}\u0000${r.producer ?? ''}`) ?? [];
    if (!list.length) { unmatched.set(r.name, 'brak w katalogu'); return null; }
    if (r.producer || list.length === 1) return list[0];
    const h = hint.get(r.name.toLowerCase());
    const pick = h?.size === 1 ? list.find((x) => h.has(x.id)) : null;
    if (pick) return pick;
    unmatched.set(r.name, 'nazwa jednoznaczna tylko z producentem (starszy plik)');
    return null;
  };
  // wiersz z jednostką niezgodną z postacią odmiany to prawie na pewno inna odmiana o tej samej nazwie
  const strainFor = (r, k) => {
    const st = resolve(r);
    if (!st) { res[k].missing++; return null; }
    if (r.unit && r.unit !== unitOf(st.form)) { res[k].invalid++; return null; }
    return st;
  };

  // --- istniejące dane konta (odczyty równolegle) ---
  const [exStrain, exPool, exUsage, exPurch, exTests, exRx, exSym, exCustom, exCVals, exNotes, exNoUse, exPrefs, pks] = await Promise.all([
    q`SELECT strain_id FROM user_strain WHERE user_id = ${me}::int`,
    q`SELECT pool_key FROM user_pool WHERE user_id = ${me}::int`,
    q`SELECT strain_id, (extract(epoch FROM date_trunc('milliseconds', created_at)) * 1000)::float8 AS t, grams::float8 AS g FROM usage_log WHERE user_id = ${me}::int`,
    q`SELECT strain_id, (extract(epoch FROM date_trunc('milliseconds', created_at)) * 1000)::float8 AS t, grams::float8 AS g FROM purchases WHERE user_id = ${me}::int`,
    q`SELECT strain_id, (extract(epoch FROM date_trunc('milliseconds', created_at)) * 1000)::float8 AS t FROM strain_tests WHERE user_id = ${me}::int`,
    q`SELECT id, to_char(issued_on, 'YYYY-MM-DD') AS a, to_char(valid_until, 'YYYY-MM-DD') AS b, grams::float8 AS g, unit FROM prescriptions WHERE user_id = ${me}::int ORDER BY id`,
    q`SELECT to_char(day, 'YYYY-MM-DD') AS d FROM symptom_log WHERE user_id = ${me}::int`,
    q`SELECT slot, lower(name) AS name FROM symptom_custom WHERE user_id = ${me}::int`,
    q`SELECT to_char(v.day, 'YYYY-MM-DD') AS d, lower(c.name) AS name FROM symptom_values v JOIN symptom_custom c ON c.id = v.custom_id WHERE v.user_id = ${me}::int`,
    q`SELECT text, done, (extract(epoch FROM date_trunc('milliseconds', created_at)) * 1000)::float8 AS t FROM doctor_notes WHERE user_id = ${me}::int`,
    q`SELECT to_char(day, 'YYYY-MM-DD') AS d FROM no_use_days WHERE user_id = ${me}::int`,
    q`SELECT 1 FROM push_prefs WHERE user_id = ${me}::int`,
    // klucze pul odmian dopasowanych w pliku: tylko takie klucze z pliku są przyjmowane
    q`SELECT pool_key(id, producer, thc, cbd, form) AS pk FROM strains WHERE id IN (SELECT (jsonb_array_elements_text(${j([...new Set([...found.values()].flat().map((x) => x.id))])}::jsonb))::int)`,
  ]);
  const ops = []; // polecenia transakcji

  // --- wpisy odmian (rating, stan, odczucia, notatka); istniejący wpis zostaje bez zmian ---
  {
    const have = new Set(exStrain.map((r) => r.strain_id)), seen = new Set(), out = [];
    for (const r of s.entries) {
      const st = strainFor(r, 'entries');
      if (!st) continue;
      if (have.has(st.id) || seen.has(st.id)) { res.entries.existing++; continue; }
      seen.add(st.id);
      const plan = planNote('user_strain', 'notes', rowScope('user_strain', { user_id: me, strain_id: st.id }), r.notes);
      if (plan.unavailable) { noteUnavailable++; res.entries.invalid++; continue; }
      res.entries.added++;
      out.push({ sid: st.id, rating: r.rating, rated_at: r.ratedAt, cur: r.current, notes: plan.value, effects: r.effects, price: r.price });
    }
    if (out.length && !dryRun) ops.push(q`INSERT INTO user_strain (strain_id, user_id, rating, rated_at, current_amount, notes, effects, visibility, price_per_g)
      SELECT x.sid, ${me}::int, x.rating, CASE WHEN x.rating IS NULL THEN NULL ELSE COALESCE(x.rated_at, now()) END, x.cur, x.notes, x.effects, 'me', x.price
      FROM jsonb_to_recordset(${j(out)}::jsonb) AS x(sid int, rating numeric, rated_at timestamptz, cur numeric, notes text, effects jsonb, price numeric)
      JOIN strains st ON st.id = x.sid
      ON CONFLICT (strain_id, user_id) DO NOTHING`);
  }

  // --- „do wykupienia”: tylko klucze równe kluczowi puli dopasowanej odmiany ---
  {
    const valid = new Set(pks.map((r) => r.pk)), have = new Set(exPool.map((r) => r.pool_key)), seen = new Set(), out = [];
    for (const r of s.pool) {
      if (!valid.has(r.key)) { res.pool.missing++; continue; }
      if (have.has(r.key) || seen.has(r.key)) { res.pool.existing++; continue; }
      seen.add(r.key); res.pool.added++; out.push({ k: r.key, g: r.grams });
    }
    if (out.length && !dryRun) ops.push(q`INSERT INTO user_pool (user_id, pool_key, remaining_to_buy)
      SELECT ${me}::int, x.k, x.g FROM jsonb_to_recordset(${j(out)}::jsonb) AS x(k text, g numeric) ON CONFLICT (user_id, pool_key) DO NOTHING`);
  }

  // --- recepty (przed zakupami: zakup wskazuje nową albo istniejącą receptę) ---
  const rxMap = new Map(); // stare id z pliku -> id recepty tego konta
  {
    const ex = multiset(exRx.map((r) => ({ id: r.id, k: `${r.a}|${r.b ?? ''}|${g2(r.g)}|${r.unit}` })), (r) => r.k);
    const fresh = [];
    for (const r of s.prescriptions) {
      const hit = ex.take(`${r.issued}|${r.valid ?? ''}|${g2(r.grams)}|${r.unit}`);
      if (hit) { res.prescriptions.existing++; if (r.oldId && !rxMap.has(r.oldId)) rxMap.set(r.oldId, hit.id); continue; }
      fresh.push(r);
    }
    let ids = [];
    if (fresh.length && !dryRun) ids = (await q`SELECT nextval(pg_get_serial_sequence('prescriptions', 'id'))::int AS id FROM generate_series(1, ${fresh.length}::int)`).map((r) => r.id);
    const out = [];
    fresh.forEach((r, i) => {
      const id = ids[i] ?? 0;
      const plan = planNote('prescriptions', 'note', rowScope('prescriptions', { user_id: me, id }), r.note);
      if (plan.unavailable) { noteUnavailable++; res.prescriptions.invalid++; return; }
      res.prescriptions.added++;
      if (r.oldId) rxMap.set(r.oldId, id);
      out.push({ id, a: r.issued, b: r.valid, g: r.grams, u: r.unit, note: plan.value });
    });
    if (out.length && !dryRun) ops.push(q`INSERT INTO prescriptions (id, user_id, issued_on, valid_until, grams, unit, note)
      SELECT x.id, ${me}::int, x.a::date, x.b::date, x.g, x.u, x.note FROM jsonb_to_recordset(${j(out)}::jsonb) AS x(id int, a text, b text, g numeric, u text, note text)`);
  }

  // --- zużycie i zakupy: wprost do historii ---
  const touched = new Set(); // odmiany z historią: dostają wiersz user_strain jak przy zwykłym zapisie
  {
    const ex = multiset(exUsage.map((r) => ({ k: `${r.strain_id}|${r.t}|${g2(r.g)}` })), (r) => r.k);
    const out = [];
    for (const r of s.usage) {
      const st = strainFor(r, 'usage');
      if (!st) continue;
      if (ex.take(`${st.id}|${ms(r.at)}|${g2(r.grams)}`)) { res.usage.existing++; continue; }
      res.usage.added++; touched.add(st.id); out.push({ sid: st.id, g: r.grams, ts: r.at, m: r.method, p: r.period });
    }
    if (out.length && !dryRun) ops.push(q`INSERT INTO usage_log (user_id, strain_id, grams, method, period, created_at)
      SELECT ${me}::int, st.id, x.g, x.m, x.p, x.ts FROM jsonb_to_recordset(${j(out)}::jsonb) AS x(sid int, g numeric, ts timestamptz, m text, p text)
      JOIN strains st ON st.id = x.sid`);
  }
  {
    const ex = multiset(exPurch.map((r) => ({ k: `${r.strain_id}|${r.t}|${g2(r.g)}` })), (r) => r.k);
    const out = [];
    for (const r of s.purchases) {
      const st = strainFor(r, 'purchases');
      if (!st) continue;
      if (ex.take(`${st.id}|${ms(r.at)}|${g2(r.grams)}`)) { res.purchases.existing++; continue; }
      res.purchases.added++; touched.add(st.id); out.push({ sid: st.id, g: r.grams, c: r.cost, rx: r.oldRx ? rxMap.get(r.oldRx) ?? null : null, nr: r.noRx, ts: r.at });
    }
    // recepta: złączenie z receptami TEGO konta (nowe z tej samej transakcji też widać); cudze id nie przejdzie
    if (out.length && !dryRun) ops.push(q`INSERT INTO purchases (user_id, strain_id, strain_name, grams, cost, prescription_id, no_rx, created_at)
      SELECT ${me}::int, st.id, st.name, x.g, x.c, p.id, x.nr, x.ts
      FROM jsonb_to_recordset(${j(out)}::jsonb) AS x(sid int, g numeric, c numeric, rx int, nr boolean, ts timestamptz)
      JOIN strains st ON st.id = x.sid LEFT JOIN prescriptions p ON p.id = x.rx AND p.user_id = ${me}::int`);
  }

  // --- testy: zawsze prywatne, bez zdjęć; limit 50 na odmianę liczony razem z istniejącymi ---
  {
    const ex = multiset(exTests.map((r) => ({ k: `${r.strain_id}|${r.t}` })), (r) => r.k);
    const perStrain = new Map();
    for (const r of exTests) perStrain.set(r.strain_id, (perStrain.get(r.strain_id) || 0) + 1);
    const fresh = [];
    for (const r of s.tests) {
      const st = strainFor(r, 'tests');
      if (!st) continue;
      if (ex.take(`${st.id}|${ms(r.at)}`)) { res.tests.existing++; continue; }
      if ((perStrain.get(st.id) || 0) >= 50) { res.tests.limit++; continue; }
      perStrain.set(st.id, (perStrain.get(st.id) || 0) + 1);
      fresh.push({ sid: st.id, note: r.note, at: r.at });
    }
    let ids = [];
    if (fresh.length && !dryRun) ids = (await q`SELECT nextval(pg_get_serial_sequence('strain_tests', 'id'))::int AS id FROM generate_series(1, ${fresh.length}::int)`).map((r) => r.id);
    const out = [];
    fresh.forEach((r, i) => {
      const id = ids[i] ?? 0;
      const plan = planNote('strain_tests', 'note', rowScope('strain_tests', { id }), r.note);
      if (plan.unavailable) { noteUnavailable++; res.tests.invalid++; return; }
      res.tests.added++; out.push({ id, sid: r.sid, note: plan.value, ts: r.at });
    });
    if (out.length && !dryRun) ops.push(q`INSERT INTO strain_tests (id, strain_id, user_id, note, visibility, created_at)
      SELECT x.id, st.id, ${me}::int, x.note, 'me', x.ts FROM jsonb_to_recordset(${j(out)}::jsonb) AS x(id int, sid int, note text, ts timestamptz)
      JOIN strains st ON st.id = x.sid`);
  }

  // --- dziennik samopoczucia (istniejący dzień zostaje bez zmian) ---
  {
    const have = new Set(exSym.map((r) => r.d)), seen = new Set(), out = [];
    for (const r of s.symptoms) {
      if (have.has(r.day) || seen.has(r.day)) { res.symptoms.existing++; continue; }
      const plan = planNote('symptom_log', 'note', rowScope('symptom_log', { user_id: me, day: r.day }), r.note);
      if (plan.unavailable) { noteUnavailable++; res.symptoms.invalid++; continue; }
      seen.add(r.day); res.symptoms.added++;
      out.push({ d: r.day, pain: r.pain, sleep: r.sleep, anxiety: r.anxiety, mood: r.mood, note: plan.value });
    }
    if (out.length && !dryRun) ops.push(q`INSERT INTO symptom_log (user_id, day, pain, sleep, anxiety, mood, note)
      SELECT ${me}::int, x.d::date, x.pain, x.sleep, x.anxiety, x.mood, x.note
      FROM jsonb_to_recordset(${j(out)}::jsonb) AS x(d text, pain int, sleep int, anxiety int, mood int, note text)
      ON CONFLICT (user_id, day) DO NOTHING`);
  }

  // --- własne objawy: najwyżej 3 na konto; wartości łączymy po nazwie (już w transakcji, po wstawieniu definicji) ---
  {
    const names = new Set(exCustom.map((r) => r.name)), free = [];
    for (let sl = 1; sl <= CUSTOM_MAX; sl++) if (!exCustom.some((r) => r.slot === sl)) free.push(sl);
    const out = [];
    for (const c of s.custom) {
      if (names.has(c.name.toLowerCase())) { res.custom.existing++; continue; }
      if (!free.length) { res.custom.limit++; continue; }
      names.add(c.name.toLowerCase()); res.custom.added++;
      out.push({ slot: free.shift(), name: c.name, hb: c.higherBetter });
    }
    if (out.length && !dryRun) ops.push(q`INSERT INTO symptom_custom (user_id, slot, name, higher_better)
      SELECT ${me}::int, x.slot, x.name, x.hb FROM jsonb_to_recordset(${j(out)}::jsonb) AS x(slot int, name text, hb boolean) ON CONFLICT DO NOTHING`);
    const have = new Set(exCVals.map((r) => `${r.d}|${r.name}`)), seen = new Set(), vals = [];
    for (const v of s.customValues) {
      const key = `${v.day}|${v.name.toLowerCase()}`;
      if (!names.has(v.name.toLowerCase())) { res.customValues.missing++; continue; }
      if (have.has(key) || seen.has(key)) { res.customValues.existing++; continue; }
      seen.add(key); res.customValues.added++; vals.push({ d: v.day, name: v.name, v: v.value });
    }
    if (vals.length && !dryRun) ops.push(q`INSERT INTO symptom_values (custom_id, user_id, day, value)
      SELECT c.id, ${me}::int, x.d::date, x.v FROM jsonb_to_recordset(${j(vals)}::jsonb) AS x(d text, name text, v int)
      JOIN symptom_custom c ON c.user_id = ${me}::int AND lower(c.name) = lower(x.name) ON CONFLICT (custom_id, day) DO NOTHING`);
  }

  // --- „Do omówienia”: najwyżej NOTES_MAX otwartych (jak w addNote), omówione bez limitu poza górną granicą sekcji ---
  {
    const ex = multiset(exNotes.map((r) => ({ k: `${r.text}|${r.t}` })), (r) => r.k);
    let open = exNotes.filter((r) => !r.done).length;
    const out = [];
    for (const r of s.doctorNotes) {
      if (ex.take(`${r.text}|${ms(r.at)}`)) { res.doctorNotes.existing++; continue; }
      if (!r.done) { if (open >= NOTES_MAX) { res.doctorNotes.limit++; continue; } open++; }
      res.doctorNotes.added++; out.push({ body: r.text, done: r.done, ts: r.at, dat: r.doneAt });
    }
    if (out.length && !dryRun) ops.push(q`INSERT INTO doctor_notes (user_id, text, done, created_at, done_at)
      SELECT ${me}::int, x.body, x.done, x.ts, CASE WHEN x.done THEN COALESCE(x.dat, x.ts) END
      FROM jsonb_to_recordset(${j(out)}::jsonb) AS x(body text, done boolean, ts timestamptz, dat timestamptz)`);
  }

  // --- dni bez zużycia ---
  {
    const have = new Set(exNoUse.map((r) => r.d)), fresh = [...new Set(s.noUse)].filter((d) => !have.has(d));
    res.noUse.existing += s.noUse.length - fresh.length; res.noUse.added = fresh.length;
    if (fresh.length && !dryRun) ops.push(q`INSERT INTO no_use_days (user_id, day) SELECT ${me}::int, d::date FROM jsonb_array_elements_text(${j(fresh)}::jsonb) AS d ON CONFLICT DO NOTHING`);
  }

  // --- ustawienia przypomnień: tylko gdy konto nie ma jeszcze własnych; urządzeń nie przenosimy ---
  if (s.prefs) {
    if (exPrefs.length) res.prefs.existing++;
    else {
      res.prefs.added++;
      const p = s.prefs;
      if (!dryRun) ops.push(q`INSERT INTO push_prefs (user_id, notify_prescription, notify_stock, stock_days, notify_hour, show_details, notify_symptoms, symptoms_hour, notify_visit, next_visit_on)
        VALUES (${me}::int, COALESCE(${p.rx}::boolean, TRUE), COALESCE(${p.stock}::boolean, TRUE), COALESCE(${p.days}::int, 5), COALESCE(${p.hour}::int, 9),
                COALESCE(${p.details}::boolean, FALSE), COALESCE(${p.sym}::boolean, FALSE), COALESCE(${p.symHour}::int, 21), COALESCE(${p.visit}::boolean, FALSE), ${p.visitOn}::date)
        ON CONFLICT (user_id) DO NOTHING`);
    }
  }

  // limity na konto, nie na plik: inaczej kolejne importy z przesuniętymi czasami dopisywałyby bez końca
  for (const [k, have] of [['usage', exUsage.length], ['purchases', exPurch.length], ['tests', exTests.length]]) {
    if (have + res[k].added > CAPS[k]) throw new HttpError(`Za dużo pozycji w sekcji „${LABELS[k]}” po imporcie (limit ${CAPS[k]} na konto).`, 422);
  }
  if (touched.size && !dryRun) ops.push(q`INSERT INTO user_strain (strain_id, user_id, visibility)
    SELECT st.id, ${me}::int, 'me' FROM jsonb_array_elements_text(${j([...touched])}::jsonb) AS t(v)
    JOIN strains st ON st.id = t.v::int ON CONFLICT (strain_id, user_id) DO NOTHING`);

  if (ops.length) await q.transaction(ops);

  if (n.droppedNotes) notes.push(`Notatek zaszyfrowanych w pliku (bez treści): ${n.droppedNotes}. Wiersze zaimportowano bez tych notatek.`);
  if (noteUnavailable) notes.push(`Pominięto wiersze z notatką, bo zapis notatek jest chwilowo niedostępny (konfiguracja szyfrowania): ${noteUnavailable}.`);
  if (n.photos) notes.push(`Zdjęcia nie są przenoszone (${n.photos}).`);
  return {
    dryRun,
    sections: ORDER.filter((k) => Object.values(res[k]).some(Boolean)).map((k) => ({ key: k, label: LABELS[k], ...res[k] })),
    total: { added: ORDER.reduce((a, k) => a + res[k].added, 0), existing: ORDER.reduce((a, k) => a + res[k].existing, 0) },
    unmatched: [...unmatched].slice(0, 20).map(([name, reason]) => ({ name, reason })),
    unmatchedCount: unmatched.size,
    notImported: n.ignored,
    notes,
  };
}
