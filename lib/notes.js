// Plan zapisu notatki z odczytem bieżącej wartości (POM-28): patrz planNote w data-crypto.js.
// Bieżącą wartość czytamy tylko wtedy, gdy wejście jest puste albo jest znacznikiem (tylko wtedy zależy od niej decyzja).
import { sql } from './db';
import { LOCKED_NOTE, planNote } from './data-crypto';

// where: { kolumna: wartość } klucza wiersza (nazwy ze stałych w trasach, nie od użytkownika)
export async function planNoteDb(table, col, where, scope, text) {
  let stored = null;
  if (text === '' || text === LOCKED_NOTE) {
    const keys = Object.keys(where);
    const rows = await sql().query(`SELECT ${col} AS v FROM ${table} WHERE ${keys.map((k, i) => `${k} = $${i + 1}`).join(' AND ')}`, Object.values(where));
    stored = rows[0]?.v ?? null;
  }
  return planNote(table, col, scope, text, stored);
}
