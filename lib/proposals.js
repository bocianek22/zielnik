import { ensureDb, sql } from './db';
import { EDIT_FIELDS, updateStrain } from './strains';

export const MAX_PENDING = 20; // oczekujących propozycji na osobę
export const REASON_MAX = 200;

// Pola z parseCommon() w postaci kolumnowej, tak jak w strain_common_json()
const toColumns = (f) => Object.fromEntries(Object.entries(EDIT_FIELDS).map(([col, key]) => [col, f[key] ?? null]));
const toFields = (changes) => Object.fromEntries(Object.entries(changes).map(([col, [, after]]) => [EDIT_FIELDS[col], after]));

// 'direct' (admin albo twórca, dopóki nikt inny odmiany nie używa), 'proposal' (każdy inny) albo null (brak odmiany)
export async function editMode(user, strainId) {
  await ensureDb();
  const [r] = await sql()`SELECT (${!!user.is_admin}::boolean OR (s.created_by = ${user.id}::int AND NOT strain_used_by_others(s.id, ${user.id}::int))) AS direct
                          FROM strains s WHERE s.id = ${strainId}::int`;
  return r ? (r.direct ? 'direct' : 'proposal') : null;
}

// Zapisuje propozycję (różnica względem bieżących wartości liczona w bazie). Nowa propozycja tej samej osoby do tej samej
// odmiany zastępuje jej oczekującą. Zwraca { id } albo { error: 'nochange' | 'limit' }.
export async function createProposal(strainId, userId, f) {
  await ensureDb();
  const newJ = JSON.stringify(toColumns(f));
  const rows = await sql()`
    WITH cur AS (SELECT strain_common_json(${strainId}::int) AS j),
    d AS (SELECT (SELECT jsonb_object_agg(n.key, jsonb_build_array(cur.j -> n.key, n.value))
                  FROM jsonb_each(${newJ}::jsonb) n WHERE cur.j -> n.key IS DISTINCT FROM n.value) AS changes
          FROM cur WHERE cur.j IS NOT NULL)
    INSERT INTO strain_proposals (strain_id, user_id, changes)
    SELECT ${strainId}::int, ${userId}::int, d.changes FROM d
    WHERE d.changes IS NOT NULL AND (
      (SELECT count(*) FROM strain_proposals WHERE user_id = ${userId}::int AND status = 'oczekuje') < ${MAX_PENDING}::int
      OR EXISTS (SELECT 1 FROM strain_proposals WHERE user_id = ${userId}::int AND strain_id = ${strainId}::int AND status = 'oczekuje'))
    ON CONFLICT (strain_id, user_id) WHERE status = 'oczekuje' DO UPDATE SET changes = EXCLUDED.changes, created_at = now()
    RETURNING id`;
  if (rows.length) return { id: rows[0].id };
  const [n] = await sql()`SELECT count(*)::int AS n FROM strain_proposals WHERE user_id = ${userId}::int AND status = 'oczekuje'`;
  return { error: n.n >= MAX_PENDING ? 'limit' : 'nochange' };
}

// Własne propozycje (wszystkie statusy, 50 ostatnich); strainId zawęża do jednej odmiany
export async function listMine(userId, strainId = null) {
  await ensureDb();
  return sql()`SELECT p.id, p.strain_id AS "strainId", s.name AS strain, s.producer, p.status, p.changes, p.reject_reason AS "rejectReason",
      to_char(p.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at,
      to_char(p.decided_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS "decidedAt"
    FROM strain_proposals p JOIN strains s ON s.id = p.strain_id
    WHERE p.user_id = ${userId}::int AND (${strainId}::int IS NULL OR p.strain_id = ${strainId}::int)
    ORDER BY p.created_at DESC, p.id DESC LIMIT 50`;
}

// Wycofanie własnej oczekującej propozycji
export async function withdraw(id, userId) {
  await ensureDb();
  return (await sql()`DELETE FROM strain_proposals WHERE id = ${id}::int AND user_id = ${userId}::int AND status = 'oczekuje' RETURNING id`).length > 0;
}

// Kolejka admina: oczekujące, od najstarszych; przy każdej zmianie bieżąca wartość i znacznik konfliktu
// (pole zmieniło się od czasu propozycji)
export async function listPending() {
  await ensureDb();
  return sql()`SELECT p.id, p.strain_id AS "strainId", s.name AS strain, s.producer, u.username AS author,
      to_char(p.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('field', c.key, 'before', c.value -> 0, 'after', c.value -> 1,
          'current', cur.j -> c.key, 'conflict', cur.j -> c.key IS DISTINCT FROM c.value -> 0)), '[]'::jsonb)
         FROM jsonb_each(p.changes) c) AS diff
    FROM strain_proposals p JOIN strains s ON s.id = p.strain_id JOIN users u ON u.id = p.user_id
    CROSS JOIN LATERAL (SELECT strain_common_json(p.strain_id) AS j) cur
    WHERE p.status = 'oczekuje' ORDER BY p.created_at, p.id LIMIT 100`;
}

// Przyjęcie: oznaczenie i sprawdzenie konfliktu w jednym zapytaniu, potem zapis tą samą ścieżką co zwykła edycja
// (updateStrain: historia zmian z autorem propozycji, przeniesienie pul, unieważnienie pamięci podręcznej).
// force: zapis mimo konfliktu. Zwraca { ok } albo { error: 'missing' | 'done' | 'conflict' }.
export async function accept(id, adminId, force = false) {
  await ensureDb();
  const [p] = await sql()`UPDATE strain_proposals p SET status = 'przyjeta', decided_at = now(), decided_by = ${adminId}::int
    WHERE p.id = ${id}::int AND p.status = 'oczekuje' AND (${!!force}::boolean OR NOT EXISTS (
      SELECT 1 FROM jsonb_each(p.changes) c WHERE strain_common_json(p.strain_id) -> c.key IS DISTINCT FROM c.value -> 0))
    RETURNING p.strain_id, p.user_id, p.changes`;
  if (!p) {
    const [r] = await sql()`SELECT status FROM strain_proposals WHERE id = ${id}::int`;
    return { error: !r ? 'missing' : r.status !== 'oczekuje' ? 'done' : 'conflict' };
  }
  try {
    await updateStrain(p.strain_id, toFields(p.changes), p.user_id);
  } catch (e) {
    await sql()`UPDATE strain_proposals SET status = 'oczekuje', decided_at = NULL, decided_by = NULL WHERE id = ${id}::int`;
    throw e;
  }
  return { ok: true };
}

export async function reject(id, adminId, reason) {
  await ensureDb();
  const rows = await sql()`UPDATE strain_proposals SET status = 'odrzucona', reject_reason = ${reason}::text, decided_at = now(), decided_by = ${adminId}::int
    WHERE id = ${id}::int AND status = 'oczekuje' RETURNING id`;
  if (rows.length) return { ok: true };
  const [r] = await sql()`SELECT 1 FROM strain_proposals WHERE id = ${id}::int`;
  return { error: r ? 'done' : 'missing' };
}
