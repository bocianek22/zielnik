import { requireUser, safe } from '@/lib/guard';
import { listStrains } from '@/lib/strains';
import { unitOf } from '@/lib/units';
import { csvText } from '@/lib/csv-export';

// Pola tekstowe przez csvText (neutralizacja formuł = + - @); liczby zostają bez zmian, bo ujemne wartości nie występują
const esc = (v) => {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

// Eksport Twoich danych do CSV (separator ; i BOM, żeby polski Excel czytał poprawnie)
export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  const head = ['Odmiana', 'Producent', 'Rodzaj', 'Typ', 'THC %', 'CBD %', 'Cena zł/g', 'Seria', 'Ważne do', 'Smak', 'Terpeny',
    'Postać', 'Ocena końcowa', 'Twoja ocena', 'Mam teraz g', 'Do wykupienia g', 'Spostrzeżenia', 'Jednostka'];
  // nagłówki z „g” zostają dla zgodności z importem; ilość i cena są w jednostce z ostatniej kolumny (g albo ml)
  const lines = [head.join(';')];
  for (const s of await listStrains(user.id)) {
    const m = s.entries.find((e) => e.userId === user.id) || {};
    const T = csvText;
    lines.push([T(s.name), T(s.producer), T(s.kind), T(s.type), s.thc, s.cbd, s.price_per_g, T(s.batch), s.expires_on, T(s.taste),
      T((s.terpenes || []).join(', ')), T(s.form), s.final_rating, m.rating, m.current, m.remaining, T(m.notes), unitOf(s.form)].map(esc).join(';'));
  }
  return new Response('\uFEFF' + lines.join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="zielnik.csv"' },
  });
});
