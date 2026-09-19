import { ensureDb, sql } from './db';

// Odmiany razem z osobistymi polami wszystkich użytkowników (jedna kolumna JSON "entries").
export async function listStrains() {
  await ensureDb();
  return sql()`
    SELECT s.id, s.producer, s.name, s.type, s.final_rating::float8 AS final_rating, s.taste, s.created_by,
      COALESCE(json_agg(json_build_object(
        'userId', us.user_id, 'username', u.username, 'rating', us.rating, 'ratedAt', us.rated_at,
        'current', us.current_amount, 'remaining', us.remaining_to_buy, 'notes', us.notes
      ) ORDER BY lower(u.username)) FILTER (WHERE us.user_id IS NOT NULL), '[]'::json) AS entries
    FROM strains s
    LEFT JOIN user_strain us ON us.strain_id = s.id
    LEFT JOIN users u ON u.id = us.user_id
    GROUP BY s.id
    ORDER BY s.created_at DESC, s.id DESC`;
}

export async function listOptions() {
  await ensureDb();
  const rows = await sql()`SELECT kind, value FROM options ORDER BY id`;
  return {
    producer: rows.filter((r) => r.kind === 'producer').map((r) => r.value),
    type: rows.filter((r) => r.kind === 'type').map((r) => r.value),
  };
}

// Zwraca istniejącą opcję (bez względu na wielkość liter) albo dopisuje nową.
export async function canonOption(kind, raw) {
  const value = String(raw ?? '').trim().slice(0, 40);
  if (!value) return null;
  const q = sql();
  const found = await q`SELECT value FROM options WHERE kind = ${kind} AND lower(value) = lower(${value})`;
  if (found.length) return found[0].value;
  await q`INSERT INTO options (kind, value) VALUES (${kind}, ${value}) ON CONFLICT DO NOTHING`;
  return value;
}

// Walidacja pól wspólnych. Zwraca { error } albo { fields }.
export async function parseCommon(body) {
  const name = String(body.name ?? '').trim().slice(0, 60);
  if (!name) return { error: 'Podaj nazwę odmiany.' };
  const producer = await canonOption('producer', body.producer);
  if (!producer) return { error: 'Wybierz producenta.' };
  const type = await canonOption('type', body.type);
  if (!type) return { error: 'Wybierz typ.' };
  const fr = parseNumber(body.finalRating, 0, 10);
  if (Number.isNaN(fr)) return { error: 'Ocena końcowa musi być liczbą od 0 do 10.' };
  const taste = String(body.taste ?? '').trim().slice(0, 120);
  return { fields: { name, producer, type, finalRating: fr, taste } };
}

// null dla pustego pola, NaN dla błędnej wartości.
export function parseNumber(v, min, max) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return NaN;
  return Math.round(n * 100) / 100;
}
