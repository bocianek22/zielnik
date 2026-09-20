import { sql } from '@/lib/db';
import { requireUser, safe } from '@/lib/guard';

// Eksport wszystkich danych zalogowanego użytkownika (RODO). ?photos=1 dołącza awatar i zdjęcia testów.
export const GET = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const withPhotos = new URL(req.url).searchParams.get('photos') === '1';
  const q = sql();
  const me = user.id;
  const [profile] = await q`SELECT username, display_name, bio, links, profile_visibility, consent_at, email FROM users WHERE id = ${me}`;
  const data = {
    exportedAt: new Date().toISOString(),
    profile,
    strainsCreated: await q`SELECT id, name, producer FROM strains WHERE created_by = ${me}`,
    entries: await q`SELECT s.name AS strain, s.producer, us.rating::float8 AS rating, us.rated_at, us.current_amount::float8 AS current_g,
        us.notes, us.effects, us.visibility FROM user_strain us JOIN strains s ON s.id = us.strain_id
      WHERE us.user_id = ${me} AND (us.rating IS NOT NULL OR us.notes <> '' OR us.current_amount > 0 OR us.effects <> '{}'::jsonb)
      ORDER BY s.name`,
    remainingToBuy: await q`SELECT pool_key, remaining_to_buy::float8 AS grams FROM user_pool WHERE user_id = ${me}`,
    usage: await q`SELECT s.name AS strain, l.grams::float8 AS grams, l.created_at FROM usage_log l JOIN strains s ON s.id = l.strain_id WHERE l.user_id = ${me} ORDER BY l.created_at`,
    purchases: await q`SELECT strain_name AS strain, grams::float8 AS grams, cost::float8 AS cost, created_at FROM purchases WHERE user_id = ${me} ORDER BY created_at`,
    tests: withPhotos
      ? await q`SELECT s.name AS strain, t.note, t.visibility, t.created_at, t.mime, t.data AS photo_base64 FROM strain_tests t JOIN strains s ON s.id = t.strain_id WHERE t.user_id = ${me} ORDER BY t.created_at`
      : await q`SELECT s.name AS strain, t.note, t.visibility, t.created_at, (t.data IS NOT NULL) AS has_photo FROM strain_tests t JOIN strains s ON s.id = t.strain_id WHERE t.user_id = ${me} ORDER BY t.created_at`,
    friends: await q`SELECT u.username, f.status FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester = ${me} THEN f.addressee ELSE f.requester END WHERE f.requester = ${me} OR f.addressee = ${me}`,
    groups: await q`SELECT g.name, gm.role, gm.status FROM group_members gm JOIN groups g ON g.id = gm.group_id WHERE gm.user_id = ${me}`,
    prescriptions: await q`SELECT issued_on, valid_until, grams::float8 AS grams, note FROM prescriptions WHERE user_id = ${me} ORDER BY issued_on`,
    symptoms: await q`SELECT to_char(day, 'YYYY-MM-DD') AS day, pain, sleep, anxiety, mood, note FROM symptom_log WHERE user_id = ${me} ORDER BY day`,
    blocked: await q`SELECT u.username FROM blocks b JOIN users u ON u.id = b.blocked WHERE b.blocker = ${me}`,
  };
  if (withPhotos) data.avatar = (await q`SELECT avatar FROM users WHERE id = ${me}`)[0]?.avatar ?? null;
  return new Response(JSON.stringify(data, null, 1), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="zielnik-moje-dane-${user.username}.json"` },
  });
});
