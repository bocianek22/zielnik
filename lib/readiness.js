import { sql } from './db';
import { parseKey } from './backup-pack';
import { alertChannels } from './alerts';
import { mailEnabled } from './mail';
import { pushConfig } from './push';

// Panel „Gotowość”: stan konfiguracji produkcji. Zwraca tylko stan (ok / missing / weak) i polską wskazówkę,
// nigdy wartości zmiennych, ich długości ani hostów (odpowiedź trafia do przeglądarki admina i do logów).
// optional: brak nie jest błędem (funkcja jest wtedy po prostu wyłączona).

const env = (k) => (process.env[k] || '').trim();
const httpsUrl = (v) => { try { return new URL(v).protocol === 'https:'; } catch { return false; } };
const item = (id, label, state, hint, optional = false) => ({ id, label, state, hint, optional });

export function configChecks() {
  const out = [];
  const guard = (id, label, optional, fn) => {
    try { out.push(fn()); } catch { out.push(item(id, label, 'weak', 'Nie udało się sprawdzić tej pozycji. Sprawdź jej wartość w Vercel.', optional)); }
  };
  guard('auth', 'AUTH_SECRET', false, () => {
    const n = env('AUTH_SECRET').length;
    return !n ? item('auth', 'AUTH_SECRET', 'missing', 'Ustaw losowy sekret sesji (openssl rand -base64 48).')
      : n < 32 ? item('auth', 'AUTH_SECRET', 'weak', 'Za krótki: potrzeba co najmniej 32 znaków. Zmiana wyloguje wszystkich.')
        : item('auth', 'AUTH_SECRET', 'ok', 'Sekret sesji ma wystarczającą długość.');
  });
  guard('backup-key', 'BACKUP_ENCRYPTION_KEY', false, () => {
    if (!env('BACKUP_ENCRYPTION_KEY')) return item('backup-key', 'BACKUP_ENCRYPTION_KEY', 'missing', 'Kopie w Blob bez szyfrowania. Ustaw klucz: openssl rand -base64 32 (kopia klucza w menedżerze haseł).');
    try { parseKey(env('BACKUP_ENCRYPTION_KEY')); } catch { return item('backup-key', 'BACKUP_ENCRYPTION_KEY', 'weak', 'Klucz musi mieć 32 bajty w base64 (openssl rand -base64 32); inaczej zapis kopii się nie uda.'); }
    return item('backup-key', 'BACKUP_ENCRYPTION_KEY', 'ok', 'Kopie w Blob są szyfrowane (AES-256-GCM).');
  });
  guard('blob', 'BLOB_READ_WRITE_TOKEN', false, () => env('BLOB_READ_WRITE_TOKEN')
    ? item('blob', 'BLOB_READ_WRITE_TOKEN', 'ok', 'Kopie zapasowe trafiają do prywatnego magazynu Blob, poza bazą.')
    : item('blob', 'BLOB_READ_WRITE_TOKEN', 'weak', 'Bez magazynu Blob kopie leżą w tej samej bazie (utrata bazy = utrata kopii). Podłącz prywatny Blob w Vercel.'));
  guard('app-url', 'APP_URL', false, () => {
    const v = env('APP_URL');
    return !v ? item('app-url', 'APP_URL', 'missing', 'Ustaw adres aplikacji (https://...), inaczej linki w mailach opierają się na liście hostów.')
      : !httpsUrl(v) ? item('app-url', 'APP_URL', 'weak', 'Adres powinien zaczynać się od https://.')
        : item('app-url', 'APP_URL', 'ok', 'Adres aplikacji ustawiony.');
  });
  guard('mail', 'RESEND_API_KEY + MAIL_FROM', false, () => mailEnabled()
    ? item('mail', 'RESEND_API_KEY + MAIL_FROM', 'ok', 'Wysyłka e-maili włączona (sprawdź domenę nadawcy w Resend).')
    : env('RESEND_API_KEY') || env('MAIL_FROM')
      ? item('mail', 'RESEND_API_KEY + MAIL_FROM', 'weak', 'Ustawiona tylko jedna z dwóch zmiennych: bez obu wysyłka jest wyłączona.')
      : item('mail', 'RESEND_API_KEY + MAIL_FROM', 'missing', 'Bez tego nie działa odzyskiwanie hasła e-mailem. Ustaw klucz Resend i adres nadawcy.'));
  guard('vapid', 'VAPID_*', false, () => {
    const n = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'].filter((k) => env(k)).length;
    return pushConfig().enabled ? item('vapid', 'VAPID_*', 'ok', 'Powiadomienia push (Web Push) włączone.')
      : n ? item('vapid', 'VAPID_*', 'weak', 'Ustawiona tylko część zmiennych VAPID: push jest wyłączony.')
        : item('vapid', 'VAPID_*', 'missing', 'Brak kluczy: przypomnienia push wyłączone (node scripts/vapid-keys.js).');
  });
  guard('cron', 'CRON_SECRET', false, () => {
    const n = env('CRON_SECRET').length;
    return !n ? item('cron', 'CRON_SECRET', 'missing', 'Bez sekretu zadania cykliczne (kopia, przypomnienia, katalog) odpowiadają odmową.')
      : n < 16 ? item('cron', 'CRON_SECRET', 'weak', 'Za krótki: użyj co najmniej 16 losowych znaków.')
        : item('cron', 'CRON_SECRET', 'ok', 'Sekret zadań cyklicznych ustawiony.');
  });
  guard('alerts', 'ALERT_WEBHOOK_URL / ALERT_EMAIL', false, () => {
    const ch = alertChannels();
    if (ch.webhook || ch.email) return item('alerts', 'ALERT_WEBHOOK_URL / ALERT_EMAIL', 'ok', `Alerty o błędach i logowaniu admina: ${[ch.webhook && 'webhook', ch.email && 'e-mail'].filter(Boolean).join(' i ')}.`);
    return env('ALERT_WEBHOOK_URL') || env('ALERT_EMAIL')
      ? item('alerts', 'ALERT_WEBHOOK_URL / ALERT_EMAIL', 'weak', 'Wartość jest nieprawidłowa (webhook musi być https, e-mail wymaga działającej wysyłki).')
      : item('alerts', 'ALERT_WEBHOOK_URL / ALERT_EMAIL', 'missing', 'Brak alertów: nie dowiesz się o błędach ani logowaniu admina. Ustaw webhook Discord lub Slack.');
  });
  guard('anthropic', 'ANTHROPIC_API_KEY', true, () => env('ANTHROPIC_API_KEY')
    ? item('anthropic', 'ANTHROPIC_API_KEY', 'ok', 'Podpowiedzi z internetu i odczyt zdjęć z apteki włączone.', true)
    : item('anthropic', 'ANTHROPIC_API_KEY', 'missing', 'Opcjonalne: bez klucza podpowiedzi z internetu i odczyt zdjęć są wyłączone.', true));
  guard('beta-group', 'BETA_GROUP_URL', true, () => httpsUrl(env('BETA_GROUP_URL'))
    ? item('beta-group', 'BETA_GROUP_URL', 'ok', 'Link do grupy testerów będzie widoczny.', true)
    : env('BETA_GROUP_URL') ? item('beta-group', 'BETA_GROUP_URL', 'weak', 'Adres musi zaczynać się od https://; inaczej link jest ukryty.', true)
      : item('beta-group', 'BETA_GROUP_URL', 'missing', 'Brak linku do grupy testerów (link jest wtedy ukryty).', true));
  guard('suggest', 'SUGGEST_DOMAINS', true, () => env('SUGGEST_DOMAINS')
    ? item('suggest', 'SUGGEST_DOMAINS', 'weak', 'Ustawione: podpowiedzi szukają tylko w wybranych serwisach. Przed betą usuń zmienną.', true)
    : item('suggest', 'SUGGEST_DOMAINS', 'ok', 'Nieustawione (podpowiedzi szukają w całym internecie).', true));
  guard('photos-blob', 'PHOTOS_BLOB', true, () => env('PHOTOS_BLOB') === '1'
    ? (env('BLOB_READ_WRITE_TOKEN') ? item('photos-blob', 'PHOTOS_BLOB', 'ok', 'Nowe zdjęcia trafiają do prywatnego Blob.', true)
      : item('photos-blob', 'PHOTOS_BLOB', 'weak', 'PHOTOS_BLOB=1 wymaga BLOB_READ_WRITE_TOKEN: bez niego zdjęcia zostają w bazie.', true))
    : item('photos-blob', 'PHOTOS_BLOB', 'missing', 'Wyłączone: zdjęcia leżą w bazie (base64). Włącz po migracji (docs/ARCHITEKTURA.md).', true));
  return out;
}

// Znacznik ostatniego przebiegu zadania cyklicznego (schema_meta: tabela techniczna, poza kopią i eksportem).
// Zapis nigdy nie przerywa zadania.
export async function markCron(name) {
  try {
    await sql()`INSERT INTO schema_meta (key, value) VALUES (${`cron:${name}`}, ${new Date().toISOString()})
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  } catch { /* bez tabeli: pomijamy */ }
}

export async function readinessReport() {
  const q = sql();
  const [pg] = await q`SELECT current_setting('server_version') AS version`;
  const [last] = await q`SELECT kind, created_at, (blob_path IS NOT NULL) AS blob FROM backups ORDER BY created_at DESC, id DESC LIMIT 1`;
  const crons = await q`SELECT replace(key, 'cron:', '') AS name, value FROM schema_meta WHERE key LIKE 'cron:%'`;
  const [err] = await q`SELECT count(*) FILTER (WHERE source <> 'przeglądarka')::int AS server, count(*) FILTER (WHERE source = 'przeglądarka')::int AS browser
                        FROM error_log WHERE at > now() - interval '24 hours'`;
  return {
    checks: configChecks(),
    postgres: String(pg.version).split(' ')[0],
    lastBackup: last ? { at: new Date(last.created_at).toISOString(), kind: last.kind, blob: !!last.blob } : null,
    crons: Object.fromEntries(crons.map((c) => [c.name, c.value])),
    errors24h: { server: err.server, browser: err.browser },
  };
}
