import { NextResponse } from 'next/server';
import { requireUser, bad, safe, jsonBody } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { MAX_BODY } from '@/lib/import-backup';
import { importBackup } from '@/lib/import-backup-db';

export const maxDuration = 60;

// POM-41: przywrócenie własnych danych z pliku eksportu JSON (Profil, „Pobierz dane”). Treść: { dryRun?, data: <plik> }.
// dryRun = tylko podsumowanie (nic nie jest zapisywane). Szczegóły i zasady: lib/import-backup-db.js.
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await jsonBody(req, MAX_BODY);
  const dryRun = b.dryRun === true;
  const data = b.data !== undefined ? b.data : b; // dopuszczamy też sam plik eksportu jako treść
  // podgląd czyta kilkanaście tabel, zapis zmienia dane: osobne, różne limity
  if (!(await hit(dryRun ? `import-backup-dry:${user.id}` : `import-backup:${user.id}`, dryRun ? 30 : 5, 3600))) return bad('Zbyt wiele prób. Spróbuj ponownie za godzinę.', 429);
  const out = await importBackup(user.id, data, { dryRun });
  if (out.error) return bad(out.error);
  return NextResponse.json(out);
});
