import Icon from './Icon';
import { LEGAL_DATE, LEGAL_DRAFT_NOTE, LEGAL_VERSION } from '@/lib/legal';

// Wspólny układ dokumentów prawnych (/regulamin, /prywatnosc): adnotacja o wersji roboczej, wersja i data, spis treści.
// Sekcja: [id, tytuł, bloki]; blok to akapit (tekst) albo lista ({ list: [...] }). Znacznik [DO UZUPEŁNIENIA] i
// „do potwierdzenia” zostają w tekście celowo: to pola dla właściciela.
export default function LegalDoc({ title, sections, other }) {
  return (
    <main className="page read read-narrow" id="top">
      <h1>{title}</h1>
      <div className="alert note read-note" role="note">
        <Icon name="info" size={20} />
        <p><strong>{LEGAL_DRAFT_NOTE}</strong></p>
      </div>
      <p className="muted legal-meta">Wersja dokumentu: {LEGAL_VERSION} · z dnia {LEGAL_DATE} · <a href={other.href}>{other.label}</a></p>

      <nav aria-label="Spis treści">
        <h2 className="section-label">Spis treści</h2>
        <ul className="list toc">
          {sections.map(([id, t]) => (
            <li key={id}><a className="list-row" href={`#${id}`}><span className="lr-main">{t}</span><Icon name="chevronRight" size={20} className="lr-chev" /></a></li>
          ))}
        </ul>
      </nav>

      {sections.map(([id, t, blocks]) => (
        <section key={id} id={id} className="read-article">
          <h2>{t}</h2>
          {blocks.map((b, i) => (typeof b === 'string'
            ? <p key={i}>{b}</p>
            : <ul key={i} className="legal-list">{b.list.map((li, j) => <li key={j}>{li}</li>)}</ul>))}
          <a className="to-top" href="#top">Do spisu treści</a>
        </section>
      ))}
    </main>
  );
}
