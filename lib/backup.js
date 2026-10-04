import { ensureDb, sql } from './db';
import { packBackup } from './backup-pack';

// Tabele pomijane w kopii: tymczasowe (rate_limits, schema_meta), cache podpowiedzi (strain_suggestions),
// same kopie (backups) i zdjęcia (strain_photos, zbyt duże; ścieżki zdjęć testów w Blob są w strain_tests.blob_path). Wszystkie pozostałe tabele z schematu public
// trafiają do kopii automatycznie, więc nowa tabela z treścią użytkownika nie wymaga zmian w tym pliku.
// push_subscriptions: klucze urządzeń (po odtworzeniu przeglądarka zapisze się ponownie), push_sent: tylko blokada powtórek z bieżącego dnia
// sessions: po odtworzeniu z kopii każdy loguje się ponownie (sesja bez wiersza jest odrzucana)
export const BACKUP_EXCLUDED = ['rate_limits', 'backups', 'schema_meta', 'strain_suggestions', 'strain_photos', 'push_subscriptions', 'push_sent', 'sessions'];
// Kolumny wycinane z wierszy (hasła, awatary, duże dane testów)
export const BACKUP_STRIP = { users: ['password_hash', 'avatar'], strain_tests: ['data'] };

export const BLOB_PREFIX = 'zielnik-backups/';
export const BLOB_RETENTION_DAYS = 84; // 12 tygodni
const DB_KEEP = 8; // ile migawek zostaje w tabeli backups (tryb bez Blob)

// Zrzut całej bazy do obiektu: { createdAt, <tabela>: [wiersze], ... }
export async function buildBackup() {
  await ensureDb();
  const q = sql();
  const tables = (await q`SELECT table_name FROM information_schema.tables
                          WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`)
    .map((t) => t.table_name).filter((n) => !BACKUP_EXCLUDED.includes(n));
  const out = { createdAt: new Date().toISOString() };
  for (const name of tables) {
    // identyfikatora nie da się sparametryzować: nazwa pochodzi z information_schema i jest dodatkowo walidowana
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Nieobsługiwana nazwa tabeli: ${name}`);
    const strip = (BACKUP_STRIP[name] || []).map((c) => ` - '${c}'`).join('');
    const text = `SELECT COALESCE(jsonb_agg(to_jsonb(t)${strip}), '[]') AS rows FROM "${name}" t`;
    out[name] = (await q(Object.assign([text], { raw: [text] })))[0].rows;
  }
  return out;
}

// Domyślny klient Vercel Blob (ładowany leniwie, żeby kod bez tokenu nie dotykał paczki)
async function vercelBlob() {
  const { put, list, del } = await import('@vercel/blob');
  return { put, list, del };
}

export const blobPathname = (kind, encrypted, now = new Date()) =>
  `${BLOB_PREFIX}${now.toISOString().replace(/[:.]/g, '-')}-${kind === 'auto' ? 'auto' : 'reczna'}.json.gz${encrypted ? '.enc' : ''}`;

// Usuwa z Blob kopie starsze niż retencja; zwraca liczbę usuniętych
export async function pruneBlobs(blob, token, now = new Date()) {
  const cutoff = now.getTime() - BLOB_RETENTION_DAYS * 86400000;
  const old = [];
  let cursor;
  do {
    const page = await blob.list({ prefix: BLOB_PREFIX, cursor, token });
    for (const b of page.blobs) if (new Date(b.uploadedAt).getTime() < cutoff) old.push(b.pathname);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  if (old.length) await blob.del(old, { token });
  return old.length;
}

// Zapisuje migawkę (kind: 'auto' | 'ręczna'). Z BLOB_READ_WRITE_TOKEN: skompresowany (i opcjonalnie zaszyfrowany)
// plik trafia do prywatnego magazynu Vercel Blob, a w tabeli backups zostają tylko metadane (blob_path).
// Bez tokenu: JSON w tabeli backups, 8 najnowszych. Parametr opts służy testom (wstrzykiwany klient, env, czas).
export async function saveSnapshot(kind, opts = {}) {
  const env = opts.env || process.env;
  const json = JSON.stringify(await buildBackup());
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    await sql()`INSERT INTO backups (kind, size, data) VALUES (${kind}, ${json.length}, ${json})`;
    await sql()`DELETE FROM backups WHERE blob_path IS NULL AND id NOT IN
                (SELECT id FROM backups WHERE blob_path IS NULL ORDER BY created_at DESC, id DESC LIMIT ${DB_KEEP}::int)`;
    return json.length;
  }
  const blob = opts.blob || await vercelBlob();
  const body = packBackup(json, env.BACKUP_ENCRYPTION_KEY);
  const path = blobPathname(kind, !!(env.BACKUP_ENCRYPTION_KEY || '').trim(), opts.now);
  await blob.put(path, body, { access: 'private', token, contentType: 'application/octet-stream', addRandomSuffix: false, allowOverwrite: false });
  await sql()`INSERT INTO backups (kind, size, data, blob_path) VALUES (${kind}, ${body.length}::int, '', ${path})`;
  await pruneBlobs(blob, token, opts.now);
  // metadane kopii, których pliku już nie ma (starsze niż retencja)
  await sql()`DELETE FROM backups WHERE blob_path IS NOT NULL
              AND created_at < ${new Date((opts.now || new Date()).getTime() - BLOB_RETENTION_DAYS * 86400000).toISOString()}::timestamptz`;
  return body.length;
}
