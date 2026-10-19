import { ensureDb, sql } from './db';
import { LOCKED_NOTE, openRows, rowScope } from './data-crypto';
import { snippet } from './notes-snippet';

// POM-17 „Moje notatki” na /szukaj: tylko notatki właściciela (userId z sesji). Notatki bywają szyfrowane (POM-28),
// więc dopasowanie jest w JS po odszyfrowaniu; z serwera wychodzi tylko krótki wycinek wokół trafienia.
// Zakres: notatka dnia w dzienniku, „Moje odczucia” przy odmianie, recepty, notatki o partii, „Do omówienia z lekarzem”, wizyty, zdarzenia niepożądane.
export const NOTES_MAX = 20;
const PER_SOURCE = 2000; // górna granica wierszy na źródło (konto ma ich zwykle kilkaset)
export async function searchNotes(userId, query) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  await ensureDb();
  const s = sql();
  const u = Number(userId) || 0;
  const [days, feel, rx, batches, doc, visits, adverse] = await Promise.all([
    s`SELECT to_char(day, 'YYYY-MM-DD') AS day, note FROM symptom_log WHERE user_id = ${u} AND note <> '' ORDER BY day DESC LIMIT ${PER_SOURCE}`,
    s`SELECT us.strain_id, st.name, us.notes, to_char(us.rated_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day
      FROM user_strain us JOIN strains st ON st.id = us.strain_id
      WHERE us.user_id = ${u} AND us.notes <> '' ORDER BY us.rated_at DESC NULLS LAST LIMIT ${PER_SOURCE}`,
    s`SELECT id, to_char(issued_on, 'YYYY-MM-DD') AS day, note FROM prescriptions WHERE user_id = ${u} AND note <> '' ORDER BY issued_on DESC LIMIT ${PER_SOURCE}`,
    s`SELECT id, strain_name AS name, batch_note, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day
      FROM purchases WHERE user_id = ${u} AND batch_note <> '' ORDER BY created_at DESC LIMIT ${PER_SOURCE}`,
    s`SELECT id, text, done, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day
      FROM doctor_notes WHERE user_id = ${u} ORDER BY created_at DESC LIMIT ${PER_SOURCE}`,
    s`SELECT id, to_char(day, 'YYYY-MM-DD') AS day, note FROM visits WHERE user_id = ${u} AND note <> '' ORDER BY day DESC LIMIT ${PER_SOURCE}`,
    s`SELECT id, to_char(day, 'YYYY-MM-DD') AS day, note FROM adverse_events WHERE user_id = ${u} AND note <> '' ORDER BY day DESC LIMIT ${PER_SOURCE}`,
  ]);
  const sources = [
    ...openRows(days, 'symptom_log', 'note', (r) => rowScope('symptom_log', { user_id: u, day: r.day }))
      .map((r) => ({ kind: 'day', title: 'Notatka dnia', day: r.day, text: r.note, href: '/dziennik' })),
    ...openRows(feel, 'user_strain', 'notes', (r) => rowScope('user_strain', { user_id: u, strain_id: r.strain_id }))
      .map((r) => ({ kind: 'feel', title: r.name, strain: true, day: r.day, text: r.notes, href: `/strains/${r.strain_id}` })),
    ...openRows(rx, 'prescriptions', 'note', (r) => rowScope('prescriptions', { user_id: u, id: r.id }))
      .map((r) => ({ kind: 'rx', title: 'Recepta', day: r.day, text: r.note, href: '/recepty' })),
    ...openRows(batches, 'purchases', 'batch_note', (r) => rowScope('purchases', { user_id: u, id: r.id }))
      .map((r) => ({ kind: 'batch', title: r.name, strain: true, day: r.day, text: r.batch_note, href: '/historia' })),
    ...openRows(visits, 'visits', 'note', (r) => rowScope('visits', { user_id: u, id: r.id }))
      .map((r) => ({ kind: 'visit', title: 'Wizyta', day: r.day, text: r.note, href: '/raport#wizyty' })),
    ...openRows(adverse, 'adverse_events', 'note', (r) => rowScope('adverse_events', { user_id: u, id: r.id }))
      .map((r) => ({ kind: 'adverse', title: 'Zdarzenie niepożądane', day: r.day, text: r.note, href: '/dziennik#zdarzenia' })),
    ...openRows(doc, 'doctor_notes', 'text', (r) => rowScope('doctor_notes', { user_id: u, id: r.id })).map((r) => ({ kind: 'doctor', title: r.done ? 'Do omówienia (omówione)' : 'Do omówienia z lekarzem', day: r.day, text: r.text, href: '/raport' })),
  ];
  const out = [];
  for (const it of sources) {
    if (!it.text || it.text === LOCKED_NOTE) continue;
    const snip = snippet(it.text, q);
    if (snip) out.push({ kind: it.kind, title: it.title, strain: !!it.strain, day: it.day, href: it.href, snip });
  }
  // najnowsze najpierw (dzień ISO porównuje się jak tekst)
  return out.sort((a, b) => String(b.day || '').localeCompare(String(a.day || ''))).slice(0, NOTES_MAX);
}
