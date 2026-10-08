import { sql } from '@/lib/db';
import { requireUser, safe } from '@/lib/guard';
import { readPhoto } from '@/lib/photos';
import { openRows, rowScope } from '@/lib/data-crypto';

// Nazwa pliku z polskimi literami (ł, ś, ż...) w nagłówku: zwykłe `filename` musi być ASCII (inaczej Response rzuca
// błąd i eksport kończy się 500), a pełną nazwę podajemy w `filename*` (RFC 6266).
const attachmentName = (name) =>
  `attachment; filename="${name.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'zielnik.json'}"; filename*=UTF-8''${encodeURIComponent(name)}`;

// Zdjęcia z Blob wracają do eksportu jako base64 (jak z bazy); gdy obiektu nie da się odczytać, pole jest puste i jest photo_error
async function inline(rows) {
  for (const r of rows) {
    if (r.blob_path) {
      try { r.photo_base64 = (await readPhoto(r.blob_path))?.toString('base64') ?? null; } catch { r.photo_base64 = null; }
      if (r.photo_base64 == null) r.photo_error = 'Nie udało się odczytać zdjęcia z magazynu.';
    }
    delete r.blob_path;
  }
  return rows;
}

// Eksport wszystkich danych zalogowanego użytkownika (RODO). ?photos=1 dołącza awatar, zdjęcia testów i dodane zdjęcia odmian.
export const GET = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const withPhotos = new URL(req.url).searchParams.get('photos') === '1';
  const q = sql();
  const me = user.id;
  const [profile] = await q`SELECT username, display_name, bio, links, profile_visibility, consent_at, consent_at AS "consentAt", consent_version AS "consentVersion", email, email_verified_at, email_consent_at, onboarded_at FROM users WHERE id = ${me}`;
  const data = {
    exportedAt: new Date().toISOString(),
    profile,
    // historia zgód (dowód z art. 7 ust. 1 RODO); profile.consentAt/consent_at/consentVersion to ta sama, najnowsza zgoda
    consentLog: await q`SELECT version, terms, health, at FROM consent_log WHERE user_id = ${me} ORDER BY at, id`,
    strainsCreated: await q`SELECT id, name, producer FROM strains WHERE created_by = ${me}`,
    strainPhotosAdded: withPhotos
      ? await inline(await q`SELECT s.name AS strain, s.producer, p.updated_at, p.mime, p.data AS photo_base64, p.blob_path FROM strain_photos p JOIN strains s ON s.id = p.strain_id WHERE p.uploaded_by = ${me} ORDER BY s.name`)
      : await q`SELECT s.name AS strain, s.producer, p.updated_at FROM strain_photos p JOIN strains s ON s.id = p.strain_id WHERE p.uploaded_by = ${me} ORDER BY s.name`,
    entries: openRows(await q`SELECT us.strain_id, s.name AS strain, s.producer, us.rating::float8 AS rating, us.rated_at, us.current_amount::float8 AS current_g, form_unit(s.form) AS unit,
        us.notes, us.effects, us.visibility, us.price_per_g::float8 AS price_per_g FROM user_strain us JOIN strains s ON s.id = us.strain_id
      WHERE us.user_id = ${me} AND (us.rating IS NOT NULL OR us.notes <> '' OR us.current_amount > 0 OR us.effects <> '{}'::jsonb)
      ORDER BY s.name`, 'user_strain', 'notes', (r) => rowScope('user_strain', { user_id: me, strain_id: r.strain_id })).map(({ strain_id: _s, ...e }) => e),
    // ilości (pola *_g, grams) są w jednostce odmiany: `unit` = 'g' (susz) albo 'ml' (olej, pen)
    remainingToBuy: await q`SELECT pool_key, remaining_to_buy::float8 AS grams,
        CASE WHEN pool_key LIKE '%|olej' OR pool_key LIKE '%|pen' THEN 'ml'
             WHEN pool_key ~ '^strain:[0-9]+$' THEN strain_unit(substr(pool_key, 8)::int) ELSE 'g' END AS unit
      FROM user_pool WHERE user_id = ${me}`,
    usage: await q`SELECT s.name AS strain, l.grams::float8 AS grams, form_unit(s.form) AS unit, l.method, usage_period(l.period, l.created_at) AS period, l.created_at FROM usage_log l JOIN strains s ON s.id = l.strain_id WHERE l.user_id = ${me} ORDER BY l.created_at`,
    purchases: await q`SELECT strain_name AS strain, grams::float8 AS grams, strain_unit(strain_id) AS unit, cost::float8 AS cost, prescription_id AS "prescriptionId", no_rx AS "noRx", created_at FROM purchases WHERE user_id = ${me} ORDER BY created_at`,
    tests: openRows(withPhotos
      ? await inline(await q`SELECT t.id, s.name AS strain, t.note, t.visibility, t.created_at, t.mime, t.data AS photo_base64, t.blob_path FROM strain_tests t JOIN strains s ON s.id = t.strain_id WHERE t.user_id = ${me} ORDER BY t.created_at`)
      : await q`SELECT t.id, s.name AS strain, t.note, t.visibility, t.created_at, (t.data IS NOT NULL) AS has_photo FROM strain_tests t JOIN strains s ON s.id = t.strain_id WHERE t.user_id = ${me} ORDER BY t.created_at`,
      'strain_tests', 'note', (r) => rowScope('strain_tests', r)).map(({ id: _id, ...t }) => t),
    strainEdits: await q`SELECT s.name AS strain, e.at, e.changes FROM strain_edits e JOIN strains s ON s.id = e.strain_id WHERE e.user_id = ${me} ORDER BY e.at`,
    // propozycje zmian odmian (KAT-1): własne, ze statusem i powodem odrzucenia
    strainProposals: await q`SELECT s.name AS strain, p.status, p.changes, p.reject_reason AS "rejectReason", p.created_at AS "createdAt", p.decided_at AS "decidedAt"
      FROM strain_proposals p JOIN strains s ON s.id = p.strain_id WHERE p.user_id = ${me} ORDER BY p.created_at`,
    // uwagi z formularza „Zgłoś uwagę” (BETA-A): własne, ze statusem; notatki admina nie eksportujemy
    feedback: await q`SELECT kind, body, status, meta, created_at AS "createdAt" FROM beta_feedback WHERE user_id = ${me} ORDER BY created_at`,
    friends: await q`SELECT u.username, f.status FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester = ${me} THEN f.addressee ELSE f.requester END WHERE f.requester = ${me} OR f.addressee = ${me}`,
    groups: await q`SELECT g.name, gm.role, gm.status FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE gm.user_id = ${me}`,
    prescriptions: openRows(await q`SELECT id, issued_on, valid_until, grams::float8 AS grams, unit, note FROM prescriptions WHERE user_id = ${me} ORDER BY issued_on`, 'prescriptions', 'note', (r) => rowScope('prescriptions', { user_id: me, id: r.id })),
    symptoms: openRows(await q`SELECT to_char(day, 'YYYY-MM-DD') AS day, pain, sleep, anxiety, mood, note FROM symptom_log WHERE user_id = ${me} ORDER BY day`, 'symptom_log', 'note', (r) => rowScope('symptom_log', { user_id: me, day: r.day })),
    customSymptoms: await q`SELECT name, higher_better AS "higherBetter", created_at AS "createdAt" FROM symptom_custom WHERE user_id = ${me} ORDER BY slot`,
    customSymptomValues: await q`SELECT to_char(v.day, 'YYYY-MM-DD') AS day, c.name AS symptom, v.value FROM symptom_values v
      JOIN symptom_custom c ON c.id = v.custom_id WHERE v.user_id = ${me} ORDER BY v.day, c.slot`,
    doctorNotes: await q`SELECT text, done, created_at AS "createdAt", done_at AS "doneAt" FROM doctor_notes WHERE user_id = ${me} ORDER BY created_at`,
    noUseDays: (await q`SELECT to_char(day, 'YYYY-MM-DD') AS day FROM no_use_days WHERE user_id = ${me} ORDER BY day`).map((r) => r.day),
    blocked: await q`SELECT u.username FROM blocks b JOIN users u ON u.id = b.blocked WHERE b.blocker = ${me}`,
    // zgłoszenia wysłane przez użytkownika (z jego własnym opisem); zgłoszeń o nim samym nie ujawniamy (dane moderacji i zgłaszających)
    reportsFiled: await q`SELECT type, reason, note, status, created_at AS "createdAt" FROM reports WHERE reporter_id = ${me} ORDER BY created_at`,
    // adresów subskrypcji (endpointy i klucze urządzeń) nie eksportujemy: to dane techniczne przeglądarki,
    // działają jak hasło do wysyłania powiadomień na urządzenie i nie mówią nic o użytkowniku; podajemy tylko ich liczbę i daty
    pushNotifications: {
      settings: (await q`SELECT notify_prescription, notify_stock, stock_days, notify_hour, show_details, notify_symptoms, symptoms_hour, notify_visit, to_char(next_visit_on, 'YYYY-MM-DD') AS next_visit_on, updated_at FROM push_prefs WHERE user_id = ${me}`)[0] ?? null,
      devices: await q`SELECT kind, created_at, last_ok_at FROM push_subscriptions WHERE user_id = ${me} ORDER BY created_at`,
    },
    // zalogowane urządzenia bez identyfikatorów sesji (to dane techniczne, nie treść konta)
    sessions: await q`SELECT device, native, country, created_at, last_used_at, expires_at, revoked_at FROM sessions WHERE user_id = ${me} ORDER BY created_at`,
  };
  if (withPhotos) data.avatar = (await q`SELECT avatar FROM users WHERE id = ${me}`)[0]?.avatar ?? null;
  return new Response(JSON.stringify(data, null, 1), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': attachmentName(`zielnik-moje-dane-${user.username}.json`), 'Cache-Control': 'no-store' },
  });
});
