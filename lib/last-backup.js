// POM-61: dzień ostatniej kopii danych pobranej na tym urządzeniu (tylko localStorage, serwer nic o tym nie wie).
// Liczy się zwykła kopia JSON i kopia zabezpieczona hasłem; CSV to nie kopia (nie da się z niej przywrócić).
export const LAST_BACKUP_KEY = 'zielnik.lastBackup';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const todayPL = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());

export function lastBackup() {
  try { const v = localStorage.getItem(LAST_BACKUP_KEY); return v && ISO.test(v) ? v : null; } catch { return null; }
}
export function markBackup() {
  try { localStorage.setItem(LAST_BACKUP_KEY, todayPL()); } catch {}
  window.dispatchEvent(new Event('zielnik:backup'));
}
// pełne dni od kopii (czas polski); null bez kopii
export const daysSince = (iso, today = todayPL()) => (iso && ISO.test(iso) ? Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${iso}T12:00:00Z`)) / 864e5) : null);
