import { NextResponse } from 'next/server';
import { requireAdmin, safe } from '@/lib/guard';
import { logAudit } from '@/lib/audit';
import { importPhotos } from '@/lib/photo-import';
import manifest from '@/data/zdjecia.json';

// Dodaje zdjęcia z wolnych licencji odmianom bez zdjęcia (tylko zweryfikowane i pasujące nazwą); niczego nie nadpisuje
export const maxDuration = 60;
export const POST = safe(async () => {
  const { user, res } = await requireAdmin();
  if (res) return res;
  const r = await importPhotos(manifest);
  await logAudit(user.username, 'dodał zdjęcia z wolnych licencji', null,
    `przypisane ${r.assigned}, odmian bez zdjęcia ${r.withoutPhoto}, błędy ${r.failed.length}`);
  return NextResponse.json(r);
});
