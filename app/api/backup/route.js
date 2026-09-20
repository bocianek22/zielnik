import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { buildBackup } from '@/lib/backup';

// Pobranie kopii zapasowej (tylko admin): bez parametru: świeży zrzut, ?id=N: zapisana migawka
export const GET = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!user.is_admin) return bad('Tylko admin może pobrać kopię zapasową.', 403);
  const id = Number(new URL(req.url).searchParams.get('id'));
  let body, day = new Date().toISOString().slice(0, 10);
  if (id) {
    const [b] = await sql()`SELECT data, to_char(created_at, 'YYYY-MM-DD') AS day FROM backups WHERE id = ${id}`;
    if (!b) return bad('Nie znaleziono kopii.', 404);
    body = b.data; day = b.day;
  } else body = JSON.stringify(await buildBackup(), null, 1);
  return new Response(body, {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="zielnik-kopia-${day}.json"` },
  });
});
