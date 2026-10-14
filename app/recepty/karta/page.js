import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { travelCard } from '@/lib/travel-card';
import { formatDay, todayPL } from '@/lib/date';
import { fmtQty } from '@/lib/units';
import Header from '../../components/Header';
import Icon from '../../components/Icon';
import PrintCard from './PrintCard';

export const dynamic = 'force-dynamic';

// POM-58: karta terapii na wyjazd i kontrolę. Zestawienie z zapisów pacjenta (recepty i zapas), lista przypominająca
// bez stwierdzeń o przepisach (to nie porada prawna). Na ekranie w trybie dyskretnym nazwy rozmyte, na wydruku jawne.
export default async function KartaTerapii() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const card = await travelCard(user.id);
  const today = todayPL();
  return (
    <>
      <Header user={user} />
      <main className="page stack travel-page">
        <header className="hero cat-hero no-print" data-cat="rx">
          <div className="hero-top">
            <span className="ic-dot sq"><Icon name="file" size={24} /></span>
            <div>
              <h1>Karta terapii</h1>
              <p className="hero-sub">Recepty i zapas w jednym miejscu, na wyjazd i do pokazania</p>
            </div>
          </div>
        </header>
        <div className="card stack no-print" data-cat="rx">
          <p className="muted small">Kartę wydrukuj albo zapisz jako PDF przed wyjazdem. Na wydruku nazwy są widoczne także w trybie dyskretnym. To zestawienie Twoich zapisów, nie dokument medyczny ani urzędowy.</p>
          <div><PrintCard /></div>
        </div>

        {/* report-sheet: style druku raportu (czarny tekst także w ciemnym motywie, tabele bez przewijania) */}
        <section className="card report-sheet travel-card" aria-labelledby="tc-h">
          <h2 id="tc-h">Zestawienie: recepty i zapas</h2>
          <p className="report-meta">Pacjent: <b>{card.patient}</b><br />Stan na: <b>{formatDay(today)}</b></p>

          <h3>Recepty (według zapisów)</h3>
          {card.rx.length === 0 ? <p className="muted">Brak zapisanych recept z terminem od dziś. <Link className="no-print" href="/recepty">Dodaj receptę</Link></p> : (
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Recepty"><table className="cmp">
              <caption className="sr-only">Recepty: data wystawienia, termin zapisany przez pacjenta, ilość przepisana</caption>
              <thead><tr><th>Wystawiona</th><th>Termin</th><th className="num">Przepisano</th></tr></thead>
              <tbody>{card.rx.map((r) => (
                <tr key={r.id}><td>{formatDay(r.issued_on)}</td><td>{r.valid_until ? `do ${formatDay(r.valid_until)}` : 'termin nie zapisany'}</td>
                  <td className="num">{fmtQty(r.grams, r.unit)}</td></tr>
              ))}</tbody>
            </table></div>
          )}

          <h3>Zapas (według zapisów w aplikacji)</h3>
          {card.stock.length === 0 ? <p className="muted">Brak zapisanego zapasu.</p> : (
            <ul className="list">
              {card.stock.map((s, i) => (
                <li key={i} className="list-row"><span className="lr-main"><span className="dn">{s.name}</span>{s.producer && <span className="lr-sub dn">{s.producer}</span>}</span>
                  <span className="lr-value">{fmtQty(s.amount, s.unit)}</span></li>
              ))}
            </ul>
          )}

          <h3>Przed wyjazdem</h3>
          <ul className="travel-check">
            <li>Oryginalne opakowania z apteki, z etykietą.</li>
            <li>Recepta albo jej wydruk (kod e-recepty) i ta karta.</li>
            <li>Zabierz tyle, ile potrzebujesz na czas wyjazdu.</li>
            <li>Wyjazd za granicę: sprawdź przepisy kraju docelowego i krajów tranzytowych oraz zasady przewoźnika, najlepiej w oficjalnych źródłach (ambasada, przewoźnik).</li>
          </ul>
          <p className="muted small">Lista przypominająca, nie porada prawna. Zestawienie powstało z zapisów prowadzonych przez pacjenta w aplikacji.</p>
        </section>
      </main>
    </>
  );
}
