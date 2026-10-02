import { sql } from '@/lib/db';
import { requireAdmin, bad, safe } from '@/lib/guard';
import { buildBackup } from '@/lib/backup';

// Pobranie kopii zapasowej (tylko admin): bez parametru: świeży zrzut, ?id=N: zapisana migawka
export const GET = safe(async (req) => {
  const { res } = await requireAdmin('Tylko admin może pobrać kopię zapasową.');
  if (res) return res;
  const id = Number(new URL(req.url).searchParams.get('id'));
  let body, day = new Date().toISOString().slice(0, 10);
  if (id) {
    const [b] = await sql()`SELECT data, blob_path, to_char(created_at, 'YYYY-MM-DD') AS day FROM backups WHERE id = ${id}`;
    if (!b) return bad('Nie znaleziono kopii.', 404);
    if (b.blob_path) {
      // kopia w Vercel Blob (gzip, ewentualnie AES-256-GCM): oddajemy plik bez zmian, rozpakowuje go scripts/backup-decrypt.js
      if (!process.env.BLOB_READ_WRITE_TOKEN) return bad('Kopia leży w Vercel Blob, a brakuje BLOB_READ_WRITE_TOKEN.', 503);
      const { get } = await import('@vercel/blob');
      const f = await get(b.blob_path, { access: 'private', useCache: false });
      if (!f || f.statusCode !== 200) return bad('Nie znaleziono pliku kopii w Blob.', 404);
      return new Response(f.stream, {
        headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="zielnik-kopia-${b.day}${b.blob_path.endsWith('.enc') ? '.json.gz.enc' : '.json.gz'}"` },
      });
    }
    body = b.data; day = b.day;
  } else body = JSON.stringify(await buildBackup(), null, 1);
  return new Response(body, {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="zielnik-kopia-${day}.json"` },
  });
});
