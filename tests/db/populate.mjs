// Pomocnik testów: po jednym wierszu we KAŻDEJ tabeli, która wskazuje na konto (klucz obcy do users), tak by test
// usunięcia konta i test odtworzenia kopii nie przechodziły „na pusto”. Wstawia wprost SQL-em (bez tras API).
// `v` = konto, którym się zajmujemy, `o` = drugie konto (strona znajomości, blokady, zgłoszenia), `a` = admin.
// Zwraca { strain } (odmiana stworzona przez `v`).
export async function populate(q, { v, o, a }) {
  const [strain] = await q`INSERT INTO strains (producer, name, type, created_by) VALUES ('Prod', ${`Odmiana-${v}`}, 'haze', ${v}) RETURNING id`;
  const s = strain.id;
  const [rx] = await q`INSERT INTO prescriptions (user_id, issued_on, valid_until, grams) VALUES (${v}, current_date, current_date + 30, 20) RETURNING id`;
  const [cust] = await q`INSERT INTO symptom_custom (user_id, slot, name) VALUES (${v}, 1, 'Własny') RETURNING id`;
  const [grp] = await q`INSERT INTO groups (name, owner_id) VALUES (${`Grupa-${v}`}, ${v}) RETURNING id`;
  await q`INSERT INTO user_strain (strain_id, user_id, rating, notes) VALUES (${s}, ${v}, 8, 'notatka')`;
  await q`INSERT INTO user_pool (user_id, pool_key, remaining_to_buy) VALUES (${v}, ${`strain:${s}`}, 5)`;
  await q`INSERT INTO purchases (user_id, strain_id, strain_name, grams, prescription_id) VALUES (${v}, ${s}, 'Odmiana', 10, ${rx.id})`;
  await q`INSERT INTO usage_log (user_id, strain_id, grams) VALUES (${v}, ${s}, 0.5)`;
  await q`INSERT INTO symptom_log (user_id, day, pain) VALUES (${v}, current_date, 3)`;
  await q`INSERT INTO symptom_values (custom_id, user_id, day, value) VALUES (${cust.id}, ${v}, current_date, 4)`;
  await q`INSERT INTO doctor_notes (user_id, text) VALUES (${v}, 'zapytać o dawkę')`;
  await q`INSERT INTO beta_feedback (user_id, kind, body) VALUES (${v}, 'pomysł', 'uwaga testowa')`;
  await q`INSERT INTO consent_log (user_id, version, terms, health) VALUES (${v}, 'test', TRUE, TRUE)`;
  await q`INSERT INTO no_use_days (user_id, day) VALUES (${v}, current_date)`;
  await q`INSERT INTO strain_tests (strain_id, user_id, note, mime, data) VALUES (${s}, ${v}, 'test', 'image/png', 'AAAA')`;
  await q`INSERT INTO strain_photos (strain_id, mime, data, uploaded_by) VALUES (${s}, 'image/png', 'AAAA', ${v})`;
  await q`INSERT INTO strain_edits (strain_id, user_id, changes) VALUES (${s}, ${v}, '{"thc":[1,2]}'::jsonb)`;
  await q`INSERT INTO strain_proposals (strain_id, user_id, changes) VALUES (${s}, ${v}, '{"thc":[1,2]}'::jsonb)`;
  await q`INSERT INTO strain_proposals (strain_id, user_id, changes, status, decided_by) VALUES (${s}, ${o}, '{"cbd":[1,2]}'::jsonb, 'rejected', ${v})`;
  await q`INSERT INTO friendships (requester, addressee, status) VALUES (${v}, ${o}, 'accepted') ON CONFLICT DO NOTHING`;
  await q`INSERT INTO friendships (requester, addressee, status) VALUES (${a}, ${v}, 'pending') ON CONFLICT DO NOTHING`;
  await q`INSERT INTO blocks (blocker, blocked) VALUES (${v}, ${a})`;
  await q`INSERT INTO blocks (blocker, blocked) VALUES (${a}, ${v})`;
  await q`INSERT INTO group_members (group_id, user_id, role, status) VALUES (${grp.id}, ${v}, 'owner', 'active')`;
  await q`INSERT INTO invites (code, created_by, max_uses) VALUES (${`INV-${v}`}, ${v}, 1)`;
  await q`INSERT INTO reports (reporter_id, target_user_id, type, reason) VALUES (${v}, ${o}, 'user', 'spam')`;
  await q`INSERT INTO reports (reporter_id, target_user_id, type, reason) VALUES (${o}, ${v}, 'user', 'spam')`;
  await q`INSERT INTO sessions (id, user_id, expires_at) VALUES (${`sess-${v}-aaaaaaaaaaaaaaaaaaaa`}, ${v}, now() + interval '1 day')`;
  await q`INSERT INTO push_subscriptions (user_id, kind, endpoint) VALUES (${v}, 'web', ${`https://fcm.googleapis.com/x/${v}`})`;
  await q`INSERT INTO push_prefs (user_id) VALUES (${v})`;
  await q`INSERT INTO push_sent (user_id, key, sent_on) VALUES (${v}, 'rx:1', current_date)`;
  await q`INSERT INTO email_tokens (user_id, purpose, token_hash, email, expires_at) VALUES (${v}, 'verify', ${`h${v}`}, 'a@b.pl', now() + interval '1 day')`;
  return { strain: s };
}
