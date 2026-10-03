// Jednorazowa migracja zdjęć odmian i testów z base64 w bazie do prywatnego Vercel Blob.
// Użycie (Node 20+), DATABASE_URL, BLOB_READ_WRITE_TOKEN i PHOTOS_BLOB=1 w środowisku:
//   PHOTOS_BLOB=1 node --experimental-default-type=module scripts/photos-to-blob.js [--dry-run] [--batch=20] [--limit=N]
// Idempotentny: przenosi tylko wiersze z blob_path IS NULL i niepustym data, więc można go powtarzać i wznawiać po przerwaniu.
// Kolejność: najpierw wdróż wersję z obsługą blob_path (kolumny tworzy ensureDb przy pierwszym żądaniu), potem uruchom skrypt.
// Wiersz jest aktualizowany tylko wtedy, gdy nadal nie ma blob_path (zdjęcie zmienione w międzyczasie zostaje nietknięte,
// a nadmiarowy obiekt jest usuwany). updated_at nie jest zmieniane (to klucz pamięci podręcznej zdjęcia w przeglądarce).
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1] ?? d;
const dry = process.argv.includes('--dry-run');
const batch = Math.max(1, Number(arg('batch', 20)) || 20);
const limit = Number(arg('limit', 0)) || Infinity;
const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!process.env.DATABASE_URL) { console.error('Brak DATABASE_URL.'); process.exit(2); }
if (!dry && !token) { console.error('Brak BLOB_READ_WRITE_TOKEN (albo użyj --dry-run).'); process.exit(2); }
if (!dry && process.env.PHOTOS_BLOB !== '1') { console.error('Ustaw PHOTOS_BLOB=1 (opt-in; albo użyj --dry-run).'); process.exit(2); }

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const sql = neon(process.env.DATABASE_URL);
const { put, del } = dry ? {} : await import('@vercel/blob');

// tabela i klucz główny (kursor); identyfikatory pochodzą ze stałej listy, nie od użytkownika
const TARGETS = [['strain_photos', 'strain_id'], ['strain_tests', 'id']];
const stats = { found: 0, moved: 0, skipped: 0, failed: 0 };

for (const [table, key] of TARGETS) {
  let last = 0;
  for (;;) {
    if (stats.found >= limit) break;
    const text = `SELECT ${key} AS id, mime, data FROM ${table} WHERE ${key} > $1::int AND blob_path IS NULL AND data IS NOT NULL AND data <> '' AND mime IS NOT NULL ORDER BY ${key} LIMIT $2::int`;
    const rows = await sql.query(text, [last, Math.min(batch, limit - stats.found)]);
    if (!rows.length) break;
    for (const r of rows) {
      last = r.id;
      stats.found++;
      if (dry) { console.log(`[dry-run] ${table} #${r.id}: ${r.mime}, ok. ${Math.round(r.data.length * 0.75 / 1024)} KB`); continue; }
      const path = `zielnik-photos/${randomUUID()}.${EXT[r.mime] || 'bin'}`;
      try {
        await put(path, Buffer.from(r.data, 'base64'), { access: 'private', token, contentType: r.mime, addRandomSuffix: false, allowOverwrite: false });
        const upd = await sql.query(`UPDATE ${table} SET blob_path = $1::text, data = '' WHERE ${key} = $2::int AND blob_path IS NULL RETURNING ${key}`, [path, r.id]);
        if (upd.length) stats.moved++;
        else { stats.skipped++; await del([path], { token }).catch(() => {}); }
      } catch (e) {
        stats.failed++;
        console.error(`Błąd ${table} #${r.id}: ${e.message}`);
        await del([path], { token }).catch(() => {});
      }
    }
    console.log(`${table}: do id ${last}, przeniesiono ${stats.moved}`);
  }
}
console.log(`${dry ? '[dry-run] ' : ''}Znaleziono ${stats.found}, przeniesiono ${stats.moved}, pominięto ${stats.skipped}, błędy ${stats.failed}.`);
process.exit(stats.failed ? 1 : 0);
