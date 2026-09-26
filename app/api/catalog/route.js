import { NextResponse } from 'next/server';
import { requireUser, bad, safe } from '@/lib/guard';
import { syncCatalog } from '@/lib/catalog';

// Ręczny import katalogu (tylko admin): { rows: [ { producent, odmiana, thc, cbd, rodzaj, dostępność } ] }
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!user.is_admin) return bad('Tylko admin może wczytać katalog.', 403);
  const { rows } = await req.json().catch(() => ({}));
  if (!Array.isArray(rows) || !rows.length) return bad('Brak wierszy do wczytania.');
  return NextResponse.json(await syncCatalog(rows, 'import ręczny'));
});
