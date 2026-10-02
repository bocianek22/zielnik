// Zamiennik `neon()` z @neondatabase/serverless: ten sam interfejs szablonu sql`...`, ale przez `pg`.
import pg from 'pg';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

// licznik zapytań (test szybkiego startu ensureDb)
export const stats = { queries: 0 };

export function neon() {
  return (strings, ...values) => {
    stats.queries++;
    let text = strings[0];
    values.forEach((_, i) => { text += `$${i + 1}${strings[i + 1]}`; });
    return pool.query(text, values).then((r) => r.rows);
  };
}
