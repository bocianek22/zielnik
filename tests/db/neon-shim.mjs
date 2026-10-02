// Zamiennik `neon()` z @neondatabase/serverless: ten sam interfejs szablonu sql`...` i sql.transaction([...]),
// ale przez `pg`. Jak w Neon zapytanie wykonuje się dopiero przy await/then, więc można je przekazać do transaction().
import pg from 'pg';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

// licznik zapytań (test szybkiego startu ensureDb)
export const stats = { queries: 0 };

const ISOLATION = { ReadUncommitted: 'READ UNCOMMITTED', ReadCommitted: 'READ COMMITTED', RepeatableRead: 'REPEATABLE READ', Serializable: 'SERIALIZABLE' };

export function neon() {
  const sql = (strings, ...values) => {
    let text = strings[0];
    values.forEach((_, i) => { text += `$${i + 1}${strings[i + 1]}`; });
    let run;
    const exec = () => (run ||= (stats.queries++, pool.query(text, values).then((r) => r.rows)));
    return { text, values, then: (ok, fail) => exec().then(ok, fail), catch: (fail) => exec().catch(fail) };
  };
  sql.transaction = async (queries, opts = {}) => {
    const client = await pool.connect();
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${ISOLATION[opts.isolationMode] || 'READ COMMITTED'}`);
      const out = [];
      for (const q of queries) { stats.queries++; out.push((await client.query(q.text, q.values)).rows); }
      await client.query('COMMIT');
      return out;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  };
  return sql;
}
