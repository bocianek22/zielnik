import { ensureDb, sql } from './db';
import { planNote, openEditable, rowScope, LOCKED_NOTE } from './data-crypto';
import { isIsoDay, todayPL } from './date';
import { ADVERSE_NOTE_MAX, ADVERSE_MAX, SEVERITIES } from './adverse-meta';

// Dziennik zdarzeń niepożądanych (POM-62): dzień, nasilenie słowne i opis pacjenta (szyfrowany). Tylko właściciel;
// bez powiązania z odmianą (nie sugerujemy związku przyczynowego; zużycie z tego dnia widać w karcie dnia).
export { ADVERSE_NOTE_MAX, ADVERSE_MAX };

// nieczytelny opis (brak klucza): note '' + noteLocked, żeby klient nie odesłał znacznika jako treści
const open = (userId, r) => openEditable('adverse_events', 'note', rowScope('adverse_events', { user_id: userId, id: r.id }), r);

export async function listAdverse(userId) {
  await ensureDb();
  const u = Number(userId) || 0;
  return (await sql()`SELECT id, to_char(day, 'YYYY-MM-DD') AS day, severity, note FROM adverse_events WHERE user_id = ${u}
    ORDER BY day DESC, id DESC LIMIT ${ADVERSE_MAX}`).map((r) => open(u, r));
}

// { day, severity, note } -> { event } albo { error, status }. Dzień od 2000-01-01 do dziś (czas polski), bez przyszłości.
export async function addAdverse(userId, input) {
  await ensureDb();
  const u = Number(userId) || 0;
  const day = String(input?.day ?? '');
  if (!isIsoDay(day) || day < '2000-01-01' || day > todayPL()) return { error: 'Podaj poprawną datę (nie z przyszłości).', status: 400 };
  const severity = String(input?.severity ?? '');
  if (!SEVERITIES.some(([v]) => v === severity)) return { error: 'Wybierz nasilenie.', status: 400 };
  let note = String(input?.note ?? '').replace(/\r\n/g, '\n').trim();
  if (note === LOCKED_NOTE) note = '';
  if (note.length > ADVERSE_NOTE_MAX) return { error: `Opis może mieć najwyżej ${ADVERSE_NOTE_MAX} znaków.`, status: 400 };
  const q = sql();
  // AAD szyfrogramu zawiera id wiersza, więc id z sekwencji przed INSERT (jak w wizytach)
  const [{ id }] = await q`SELECT nextval(pg_get_serial_sequence('adverse_events', 'id'))::int AS id`;
  const plan = planNote('adverse_events', 'note', rowScope('adverse_events', { user_id: u, id }), note);
  if (plan.unavailable) return { error: 'Zapis opisu jest chwilowo niedostępny. Spróbuj ponownie później.', status: 422 };
  // limit w tym samym zapytaniu co INSERT (równoległe zapisy go nie przekroczą)
  const ins = await q`INSERT INTO adverse_events (id, user_id, day, severity, note)
    SELECT ${id}::int, ${u}::int, ${day}::date, ${severity}::text, ${plan.value}::text
    WHERE (SELECT count(*) FROM adverse_events WHERE user_id = ${u}::int) < ${ADVERSE_MAX}::int RETURNING id`;
  if (!ins.length) return { error: `Możesz zapisać najwyżej ${ADVERSE_MAX} zdarzeń.`, status: 409 };
  return { event: { id, day, severity, note } };
}

// Usuwa zdarzenie; false, gdy to nie Twoje
export async function deleteAdverse(userId, id) {
  await ensureDb();
  return (await sql()`DELETE FROM adverse_events WHERE id = ${Number(id) || 0} AND user_id = ${Number(userId) || 0} RETURNING id`).length > 0;
}
