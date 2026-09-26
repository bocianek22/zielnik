import { ensureDb, sql } from './db';

// Własny dziennik błędów (bez zewnętrznych usług). Zapis nigdy nie przerywa obsługi żądania.
export async function logError(source, err, { path = null, digest = null } = {}) {
  try {
    await ensureDb();
    const message = String(err?.message ?? err ?? 'nieznany błąd').slice(0, 500);
    await sql()`INSERT INTO error_log (source, message, digest, path) VALUES (${source}, ${message}, ${digest ?? err?.digest ?? null}, ${path ? String(path).slice(0, 200) : null})`;
    if (Math.random() < 0.05) await sql()`DELETE FROM error_log WHERE id NOT IN (SELECT id FROM error_log ORDER BY id DESC LIMIT 500)`;
  } catch {
    /* brak bazy lub tabeli: pomijamy */
  }
}
