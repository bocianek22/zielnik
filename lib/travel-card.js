import { ensureDb, sql } from './db';
import { normUnit } from './units';

// Karta terapii (POM-58): jeden widok do pokazania lub wydruku w podróży i przy kontroli. Tylko dane właściciela:
// ważne recepty (data wystawienia, termin, przepisano, do wykupienia) i obecny zapas według odmian (nazwa, producent,
// ilość). Bez notatek (mogą zawierać dane lekarza) i bez cen. Dni w czasie polskim.
export async function travelCard(userId) {
  await ensureDb();
  const q = sql();
  const u = Number(userId) || 0;
  const [rx, stock, [me]] = await Promise.all([
    q`SELECT p.id, to_char(p.issued_on, 'YYYY-MM-DD') AS issued_on, to_char(p.valid_until, 'YYYY-MM-DD') AS valid_until,
        p.grams::float8 AS grams, p.unit,
        rx_bought(p.user_id, p.id, p.unit, p.issued_on, p.valid_until, NULL)::float8 AS bought
      FROM prescriptions p
      WHERE p.user_id = ${u} AND (p.valid_until IS NULL OR p.valid_until >= (now() AT TIME ZONE 'Europe/Warsaw')::date)
      ORDER BY p.valid_until NULLS LAST, p.issued_on`,
    q`SELECT s.name, s.producer, form_unit(s.form) AS unit, us.current_amount::float8 AS amount
      FROM user_strain us JOIN strains s ON s.id = us.strain_id
      WHERE us.user_id = ${u} AND us.current_amount > 0
      ORDER BY form_unit(s.form), us.current_amount DESC, s.name`,
    q`SELECT COALESCE(NULLIF(display_name, ''), username) AS name FROM users WHERE id = ${u}`,
  ]);
  return {
    patient: me?.name ?? '',
    rx: rx.map((r) => ({ ...r, unit: normUnit(r.unit), remaining: Math.max(Math.round((r.grams - r.bought) * 100) / 100, 0) })),
    stock: stock.map((s) => ({ ...s, unit: normUnit(s.unit) })),
  };
}
