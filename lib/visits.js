import { ensureDb, sql } from './db';
import { planNote, decryptField, rowScope, LOCKED_NOTE } from './data-crypto';
import { isIsoDay, todayPL, addDaysIso } from './date';

// Dziennik wizyt (POM-52): data wizyty i własna notatka pacjenta (co ustalono), szyfrowana jak inne notatki.
// Wszystko po user_id z sesji; bez pól o lekarzu czy placówce (dane osób trzecich), tylko to, co pacjent sam zapisze.
import { VISIT_NOTE_MAX, VISITS_MAX } from './visits-meta';

export { VISIT_NOTE_MAX, VISITS_MAX };

const open = (userId, r) => ({ id: r.id, day: r.day, note: r.note ? decryptField('visits', 'note', rowScope('visits', { user_id: userId, id: r.id }), r.note) : '' });

export async function listVisits(userId) {
  await ensureDb();
  const u = Number(userId) || 0;
  return (await sql()`SELECT id, to_char(day, 'YYYY-MM-DD') AS day, note FROM visits WHERE user_id = ${u} ORDER BY day DESC, id DESC LIMIT ${VISITS_MAX}`)
    .map((r) => open(u, r));
}

// { day, note } -> { visit } albo { error, status }. Dzień: od 2000-01-01 do roku naprzód (wpis zaplanowanej wizyty).
export async function addVisit(userId, input) {
  await ensureDb();
  const u = Number(userId) || 0;
  const day = String(input?.day ?? '');
  if (!isIsoDay(day) || day < '2000-01-01' || day > addDaysIso(todayPL(), 366)) return { error: 'Podaj poprawną datę wizyty.', status: 400 };
  let note = String(input?.note ?? '').replace(/\r\n/g, '\n').trim();
  if (note === LOCKED_NOTE) note = '';
  if (note.length > VISIT_NOTE_MAX) return { error: `Notatka może mieć najwyżej ${VISIT_NOTE_MAX} znaków.`, status: 400 };
  const q = sql();
  const [{ n }] = await q`SELECT count(*)::int AS n FROM visits WHERE user_id = ${u}`;
  if (n >= VISITS_MAX) return { error: `Możesz zapisać najwyżej ${VISITS_MAX} wizyt.`, status: 409 };
  // AAD szyfrogramu zawiera id wiersza, więc id z sekwencji przed INSERT (jak w receptach)
  const [{ id }] = await q`SELECT nextval(pg_get_serial_sequence('visits', 'id'))::int AS id`;
  const plan = planNote('visits', 'note', rowScope('visits', { user_id: u, id }), note);
  if (plan.unavailable) return { error: 'Zapis notatki jest chwilowo niedostępny. Spróbuj ponownie później.', status: 422 };
  await q`INSERT INTO visits (id, user_id, day, note) VALUES (${id}, ${u}, ${day}::date, ${plan.value})`;
  return { visit: { id, day, note } };
}

// Usuwa wizytę; false, gdy to nie Twoja wizyta
export async function deleteVisit(userId, id) {
  await ensureDb();
  return (await sql()`DELETE FROM visits WHERE id = ${Number(id) || 0} AND user_id = ${Number(userId) || 0} RETURNING id`).length > 0;
}
