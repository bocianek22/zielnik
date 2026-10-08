import { ensureDb, sql } from './db';
import { checkAlerts } from './alerts';
import { background } from './mail';

// Własny dziennik błędów (bez zewnętrznych usług). Zapis nigdy nie przerywa obsługi żądania.
// Ścieżka bez zapytania (?q=..., ?from=...): parametry mogą zawierać wyszukiwane odmiany i daty z raportu.
export async function logError(source, err, { path = null, digest = null } = {}) {
  try {
    await ensureDb();
    const message = String(err?.message ?? err ?? 'nieznany błąd').slice(0, 500);
    const p = path ? String(path).split(/[?#]/)[0].slice(0, 200) : null;
    await sql()`INSERT INTO error_log (source, message, digest, path) VALUES (${source}, ${message}, ${digest ?? err?.digest ?? null}, ${p})`;
    // PLA-2: po odpowiedzi (after()), by webhook i mail nie opóźniały błędu 500; poza zakresem żądania (np. onRequestError)
    // background() uruchamia od razu, bez czekania. Bez ALERT_WEBHOOK_URL / ALERT_EMAIL nic nie robi.
    background(() => checkAlerts({ source, message, path: p }));
    if (Math.random() < 0.05) await sql()`DELETE FROM error_log WHERE id NOT IN (SELECT id FROM error_log ORDER BY id DESC LIMIT 500)`;
  } catch {
    /* brak bazy lub tabeli: pomijamy */
  }
}
