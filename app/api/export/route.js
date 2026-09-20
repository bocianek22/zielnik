import { requireUser, safe } from '@/lib/guard';
import { listStrains } from '@/lib/strains';

const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

// Eksport Twoich danych do CSV (separator ; i BOM, żeby polski Excel czytał poprawnie)
export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  const head = ['Odmiana', 'Producent', 'Rodzaj', 'Typ', 'THC %', 'CBD %', 'Cena zł/g', 'Seria', 'Ważne do', 'Smak', 'Terpeny',
    'Postać', 'Ocena końcowa', 'Twoja ocena', 'Mam teraz g', 'Do wykupienia g', 'Spostrzeżenia'];
  const lines = [head.join(';')];
  for (const s of await listStrains(user.id)) {
    const m = s.entries.find((e) => e.userId === user.id) || {};
    lines.push([s.name, s.producer, s.kind, s.type, s.thc, s.cbd, s.price_per_g, s.batch, s.expires_on, s.taste,
      (s.terpenes || []).join(', '), s.form, s.final_rating, m.rating, m.current, m.remaining, m.notes].map(esc).join(';'));
  }
  return new Response('\uFEFF' + lines.join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="zielnik.csv"' },
  });
});
