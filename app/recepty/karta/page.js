import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { travelCard } from '@/lib/travel-card';
import { todayPL } from '@/lib/date';
import { CARD_TEXT, cardLang, cardDay, cardQty } from '@/lib/travel-card-text';
import Header from '../../components/Header';
import Icon from '../../components/Icon';
import PrintCard from './PrintCard';

export const dynamic = 'force-dynamic';

// POM-58: karta terapii na wyjazd i kontrolę. Zestawienie z zapisów pacjenta (recepty i zapas), lista przypominająca
// bez stwierdzeń o przepisach (to nie porada prawna). Na ekranie w trybie dyskretnym nazwy rozmyte, na wydruku jawne.
// ?lang=en (POM-64): sama karta po angielsku (etykiety, daty, liczby), dane bez tłumaczenia; reszta strony po polsku.
export default async function KartaTerapii({ searchParams }) {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const card = await travelCard(user.id);
  const today = todayPL();
  const lang = cardLang((await searchParams)?.lang);
  const t = CARD_TEXT[lang];
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
          <nav className="seg report-mode" aria-label="Język karty">
            {[['pl', 'Polski', 'pl'], ['en', 'English', 'en']].map(([l, label, hl]) => (
              <Link key={l} href={l === 'pl' ? '/recepty/karta' : '/recepty/karta?lang=en'} lang={hl} className={l === lang ? 'on' : ''} aria-current={l === lang ? 'page' : undefined} replace scroll={false}>{label}</Link>
            ))}
          </nav>
          <div><PrintCard /></div>
        </div>

        {/* report-sheet: style druku raportu (czarny tekst także w ciemnym motywie, tabele bez przewijania) */}
        <section className="card report-sheet travel-card" aria-labelledby="tc-h" lang={lang}>
          <h2 id="tc-h">{t.title}</h2>
          <p className="report-meta">{t.patient}: <b>{card.patient}</b><br />{t.asOf}: <b>{cardDay(today, lang)}</b></p>

          <h3>{t.rxHead}</h3>
          {card.rx.length === 0 ? <p className="muted">{t.rxNone} <Link className="no-print" href="/recepty" lang="pl">Dodaj receptę</Link></p> : (
            <div className="table-wrap" tabIndex={0} role="region" aria-label={t.rxRegion}><table className="cmp">
              <caption className="sr-only">{t.rxCaption}</caption>
              <thead><tr><th>{t.issued}</th><th>{t.term}</th><th className="num">{t.prescribed}</th></tr></thead>
              <tbody>{card.rx.map((r) => (
                <tr key={r.id}><td>{cardDay(r.issued_on, lang)}</td><td>{r.valid_until ? t.until(cardDay(r.valid_until, lang)) : t.noTerm}</td>
                  <td className="num">{cardQty(r.grams, r.unit, lang)}</td></tr>
              ))}</tbody>
            </table></div>
          )}

          <h3>{t.stockHead}</h3>
          {card.stock.length === 0 ? <p className="muted">{t.stockNone}</p> : (
            <ul className="list">
              {card.stock.map((s, i) => (
                <li key={i} className="list-row"><span className="lr-main"><span className="dn">{s.name}</span>{s.producer && <span className="lr-sub dn">{s.producer}</span>}</span>
                  <span className="lr-value">{cardQty(s.amount, s.unit, lang)}</span></li>
              ))}
            </ul>
          )}

          <h3>{t.checkHead}</h3>
          <ul className="travel-check">
            {t.check.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <p className="muted small">{t.note}</p>
        </section>
      </main>
    </>
  );
}
