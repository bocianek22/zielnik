import { EFFECTS, strainTags } from '@/lib/effects';
import { formLabel } from '@/lib/forms';
import { unitOf } from '@/lib/units';
import { Section } from './Fold';
import Icon from './Icon';

const dec = (n) => String(n).replace('.', ','); // jak dec() w StrainCard.js (ten plik renderuje też strona serwerowa katalogu)
const fx = (n) => String(Number(n.toFixed(1))).replace('.', ',');

// Karta charakterystyki odmiany: opis, dane, terpeny, odczucia użytkowników, średnia cena, źródła
// hidePrice: aplikacja natywna (lib/client.js), bez średniej ceny
// compact: strona odmiany pokazuje rodzaj, stężenia, terpeny i smak w nagłówku, więc tu ich nie powtarzamy
export default function CharacteristicCard({ strain, hidePrice = false, compact = false, fold = false }) {
  const tags = strainTags(strain);
  const feel = EFFECTS.map(([k, label]) => {
    const v = (strain.entries || []).map((e) => e.effects?.[k]).filter((x) => x != null);
    return v.length ? [label, v.reduce((a, b) => a + b, 0) / v.length, v.length] : null;
  }).filter(Boolean);
  const price = strain.avg_price != null
    ? `${strain.avg_price.toFixed(2).replace('.', ',')} zł/${unitOf(strain.form)} (średnia z ${strain.price_n} zgłoszeń użytkowników)`
    : strain.price_n ? `za mało zgłoszeń do średniej (${strain.price_n}, potrzeba co najmniej 3)` : 'brak zgłoszeń cen';

  return (
    <Section fold={fold} cat="learn" icon="book" title="Karta charakterystyki" className="charcard">
      <p className="priv-note charcard-note"><Icon name="info" size={18} />Informacje mają charakter poglądowy i edukacyjny. Nie zastępują porady lekarza: dobór odmiany i dawkowanie ustal z lekarzem prowadzącym.</p>
      {strain.description
        ? <p className="detail-desc">{strain.description}</p>
        : <p className="muted">Brak opisu. Dodaj go w edycji odmiany, możesz użyć podpowiedzi z internetu.</p>}
      {strain.description_auto && <p><span className="badge">Opis z internetu, poglądowy</span></p>}
      {(!compact || !hidePrice) && <dl className="klist">
        {!compact && strain.kind && <div><dt>Rodzaj</dt><dd>{strain.kind}</dd></div>}
        {!compact && strain.type && strain.type !== 'nieokreślony' && <div><dt>Typ</dt><dd>{strain.type}</dd></div>}
        {!compact && strain.form && strain.form !== 'susz' && <div><dt>Postać</dt><dd>{formLabel(strain.form)}</dd></div>}
        {!compact && (strain.thc != null || strain.cbd != null) && <div><dt>Stężenie</dt><dd>{strain.thc != null && `THC ${dec(strain.thc)}%`}{strain.thc != null && strain.cbd != null && ', '}{strain.cbd != null && `CBD ${dec(strain.cbd)}%`}</dd></div>}
        {!compact && strain.terpenes?.length > 0 && <div><dt>Terpeny</dt><dd>{strain.terpenes.join(', ')}</dd></div>}
        {!compact && strain.taste && <div><dt>Smak i aromat</dt><dd>{strain.taste}</dd></div>}
        {!hidePrice && <div><dt>Średnia cena</dt><dd>{price}</dd></div>}
      </dl>}
      {feel.length > 0 && (
        <>
          <h3>Odczucia użytkowników</h3>
          <dl className="klist feel">
            {feel.map(([label, avg, n]) => <div key={label}><dt>{label}</dt><dd><b>{fx(avg)}</b>/10 <span className="muted">· {n} {n === 1 ? 'ocena' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'oceny' : 'ocen'}</span></dd></div>)}
          </dl>
          {tags.length > 0 && <p>Tagi: {tags.map((t) => <span key={t} className="chip tag">{t}</span>)}</p>}
        </>
      )}
      {strain.sources?.length > 0 && (
        <>
          <h3>Źródła</h3>
          <ul>{strain.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.title}</a></li>)}</ul>
        </>
      )}
    </Section>
  );
}
