import { ensureDb, sql } from './db';

// Spis do podpowiedzi i wyników strony /szukaj: odmiany (wspólne dla wszystkich), aktywne pozycje katalogu
// i grupy, do których użytkownik należy. Osoby nie trafiają do spisu: przychodzą z /api/users/search (od 2 znaków).
export async function searchIndex(userId) {
  await ensureDb();
  const s = sql();
  const [strains, catalog, groups] = await Promise.all([
    s`SELECT id, name, producer, kind, taste, terpenes FROM strains ORDER BY lower(name), id LIMIT 3000`,
    s`SELECT id, name, producer, form FROM market_catalog WHERE active ORDER BY lower(name), id LIMIT 3000`,
    s`SELECT g.id, g.name FROM groups g
      JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ${userId}::int AND gm.status = 'active'
      ORDER BY lower(g.name), g.id`,
  ]);
  return { strains, catalog, groups };
}
