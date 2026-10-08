import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { requireAdmin, bad, safe, jsonBody } from '@/lib/guard';
import { buildBackup } from '@/lib/backup';
import { clear, hit } from '@/lib/ratelimit';

// Dawny adres GET (link w panelu) nie wydaje już kopii: przejęta sesja admina nie może pobrać zrzutu bez hasła.
export const GET = safe(async () => bad('Pobieranie kopii wymaga ponownego podania hasła. Odśwież panel admina i użyj przycisku w panelu.', 405));

// Pobranie kopii zapasowej (tylko admin, po ponownym podaniu hasła): { password } = świeży zrzut, { password, id } = zapisana migawka.
// Limit prób jak przy usuwaniu konta: przejęta sesja nie może zgadywać hasła admina.
export const POST = safe(async (req) => {
  const { user, res } = await requireAdmin('Tylko admin może pobrać kopię zapasową.');
  if (res) return res;
  const b = await jsonBody(req);
  const pwd = String(b.password ?? '');
  if (!(await hit(`backup-dl:${user.id}`, 5, 900))) return bad('Zbyt wiele prób. Spróbuj ponownie za kilka minut.', 429);
  const [u] = await sql()`SELECT password_hash FROM users WHERE id = ${user.id}`;
  if (!pwd || !u || pwd.length > 1000 || !(await bcrypt.compare(pwd, u.password_hash))) return bad('Nieprawidłowe hasło.', 403);
  await clear(`backup-dl:${user.id}`);
  const id = Number(b.id);
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
