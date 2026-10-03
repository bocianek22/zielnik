import { NextResponse } from 'next/server';
import { requireAdmin, safe } from '@/lib/guard';
import { logAudit } from '@/lib/audit';
import { enrichStrains } from '@/lib/enrich';
import catalog from '@/data/odmiany.json';

// Uzupełnia puste pola (smak, terpeny, opis) odmian z katalogu Zielnika; niczego nie nadpisuje
export const POST = safe(async () => {
  const { user, res } = await requireAdmin();
  if (res) return res;
  const r = await enrichStrains(catalog.strains);
  await logAudit(user.username, 'uzupełnił dane odmian z katalogu Zielnika', null,
    `zmienione ${r.updated}, bez zmian ${r.unchanged}, bez dopasowania ${r.unmatched}, niejednoznaczne ${r.ambiguous.length}`);
  return NextResponse.json({ ...r, catalogSize: catalog.strains.length });
});
