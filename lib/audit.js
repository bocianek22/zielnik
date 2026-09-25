import { ensureDb, sql } from './db';

// Dziennik działań administratora. Zapis nigdy nie przerywa akcji, którą loguje.
export async function logAudit(actor, action, target = null, details = null) {
  try {
    await ensureDb();
    await sql()`INSERT INTO audit_log (actor, action, target, details) VALUES (${actor}, ${action}, ${target}, ${details ? String(details).slice(0, 300) : null})`;
    if (Math.random() < 0.05) await sql()`DELETE FROM audit_log WHERE id NOT IN (SELECT id FROM audit_log ORDER BY id DESC LIMIT 1000)`;
  } catch { /* brak bazy: pomijamy, nie blokujemy akcji */ }
}
