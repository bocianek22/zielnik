import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hit } from '@/lib/ratelimit';
import { requireUser, bad, safe, intId, jsonBody } from '@/lib/guard';
import { parseNumber } from '@/lib/strains';
import { normUnit } from '@/lib/units';
import { planNote, decryptField, rowScope, LOCKED_NOTE, NOTE_UNAVAILABLE_REJECT_MSG } from '@/lib/data-crypto';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const list = async (me) => (await sql()`
  SELECT p.id, to_char(p.issued_on, 'YYYY-MM-DD') AS issued_on, to_char(p.valid_until, 'YYYY-MM-DD') AS valid_until,
         p.grams::float8 AS grams, p.unit, p.note,
         rx_bought(p.user_id, p.id, p.unit, p.issued_on, p.valid_until, NULL)::float8 AS bought,
         rx_bought_est(p.user_id, p.id, p.unit, p.issued_on, p.valid_until, NULL)::float8 AS estimated
  FROM prescriptions p WHERE p.user_id = ${me}::int ORDER BY p.issued_on DESC, p.id DESC`).map((r) => ({ ...r, note: decryptField('prescriptions', 'note', rowScope('prescriptions', { user_id: me, id: r.id }), r.note) }));

export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ prescriptions: await list(user.id) });
});

// { issuedOn, validUntil?, grams, unit? ('g' | 'ml'), note?, relink? }
// relink: identyfikatory zakupów do ponownego powiązania (tylko „Cofnij” po usunięciu tej recepty): wyłącznie własne
// i niepowiązane z żadną receptą (usunięcie recepty zostawia je z prescription_id = NULL)
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await jsonBody(req);
  const relink = (Array.isArray(b.relink) ? b.relink : []).slice(0, 500).map(intId).filter(Boolean);
  // „Cofnij” po usunięciu (relink) ma osobny limit: usunięcie poszło już na serwer, więc odtworzenie nie może przegrać
  // z limitem nowych recept
  if (!(await hit(`${relink.length ? 'rx-undo' : 'rx-new'}:${user.id}`, 30, 3600))) return bad('Zbyt wiele nowych recept. Spróbuj ponownie później.', 429);
  const issued = String(b.issuedOn ?? '');
  const valid = String(b.validUntil ?? '') || null;
  const grams = parseNumber(b.grams, 0.1, 100000);
  if (!DATE.test(issued) || Number.isNaN(Date.parse(issued))) return bad('Podaj datę wystawienia.');
  if (valid && (!DATE.test(valid) || Number.isNaN(Date.parse(valid)) || valid < issued)) return bad('Data ważności musi być późniejsza niż wystawienia.');
  if (grams == null || Number.isNaN(grams)) return bad('Podaj przepisaną ilość (g lub ml).');
  let note = String(b.note ?? '').trim().slice(0, 120);
  if (note === LOCKED_NOTE) note = ''; // znacznik nieczytelnej notatki nie jest treścią
  // AAD szyfrogramu zawiera id wiersza, więc id pobieramy z sekwencji przed INSERT (Neon HTTP nie ma interaktywnej transakcji)
  const [{ rid }] = await sql()`SELECT nextval(pg_get_serial_sequence('prescriptions', 'id'))::int AS rid`;
  const plan = planNote('prescriptions', 'note', rowScope('prescriptions', { user_id: user.id, id: rid }), note);
  if (plan.unavailable) return bad(NOTE_UNAVAILABLE_REJECT_MSG, 422);
  const q = sql();
  await q.transaction([
    q`INSERT INTO prescriptions (id, user_id, issued_on, valid_until, grams, unit, note)
      VALUES (${rid}, ${user.id}, ${issued}::date, ${valid}::date, ${grams}, ${normUnit(b.unit)}, ${plan.value})`,
    q`UPDATE purchases SET prescription_id = ${rid}
      WHERE user_id = ${user.id} AND id = ANY(${relink}::int[]) AND prescription_id IS NULL`,
  ]);
  return NextResponse.json({ prescriptions: await list(user.id) });
});

export const DELETE = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const { id } = await jsonBody(req);
  // powiązane zakupy (prescription_id przejdzie w NULL) wracają do klienta, żeby „Cofnij” mogło je powiązać z odtworzoną receptą
  // jedno zapytanie: lista zakupów jest z tej samej migawki co usunięcie (zakup dopięty w międzyczasie nie umknie)
  const gone = await sql()`WITH d AS (DELETE FROM prescriptions WHERE id = ${intId(id)} AND user_id = ${user.id} RETURNING id)
    SELECT p.id FROM purchases p JOIN d ON p.prescription_id = d.id WHERE p.user_id = ${user.id}
    UNION ALL SELECT NULL FROM d`;
  return NextResponse.json({ prescriptions: await list(user.id), relink: gone.filter((r) => r.id != null).map((r) => r.id) });
});
