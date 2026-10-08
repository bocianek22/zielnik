import { NextResponse } from 'next/server';
import { requireAdmin, requireUser, bad, safe, jsonBody } from '@/lib/guard';
import { syncCatalog, listCatalog } from '@/lib/catalog';

// Lekka lista aktywnych pozycji katalogu, do podpowiadania nazw przy dodawaniu odmiany
export const GET = safe(async () => {
  const { res } = await requireUser();
  if (res) return res;
  const items = await listCatalog();
  return NextResponse.json({ items: items.filter((i) => i.active).map((i) => ({ id: i.id, producer: i.producer, name: i.name, kind: i.kind, form: i.form, thc: i.thc, cbd: i.cbd })) });
});

// Ręczny import katalogu (tylko admin): { rows: [ { producent, odmiana, thc, cbd, rodzaj, dostępność } ], mode? }
// mode 'zdjecie': lista częściowa ze zdjęcia apteki, scalana bez oznaczania braków (syncCatalog merge)
export const POST = safe(async (req) => {
  const { res } = await requireAdmin('Tylko admin może wczytać katalog.');
  if (res) return res;
  const { rows, mode } = await jsonBody(req);
  if (!Array.isArray(rows) || !rows.length) return bad('Brak wierszy do wczytania.');
  if (mode === 'zdjecie') return NextResponse.json(await syncCatalog(rows, 'zdjęcie z apteki', { merge: true }));
  return NextResponse.json(await syncCatalog(rows, 'import ręczny'));
});
