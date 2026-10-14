import Link from 'next/link';
import { fmtNum } from '@/lib/units';

const dayWord = (n) => (n === 1 ? 'dzień' : 'dni');

// POM-18: własne średnie objawów w dniach z tą odmianą i w dniach bez zużycia (lib/observations.js, strainView).
// Opis, nie ocena: bez kolorów lepiej/gorzej, bez strzałek i rankingów; poniżej progu tylko liczba dni.
function Cell({ cell, min }) {
  return cell.avg != null
    ? <><b>{fmtNum(cell.avg, 1)}</b><span>{cell.days} {dayWord(cell.days)}</span></>
    : <><b className="few">–</b><span>{cell.days} {dayWord(cell.days)}, za mało (min. {min})</span></>;
}

export default function StrainFeel({ feel }) {
  if (!feel || feel.useDays === 0) {
    return <p className="muted small">Zapisz zużycie tej odmiany i wpisy w dzienniku objawów, a pokażę tu Twoje średnie z ostatnich {feel?.period ?? 90} dni.</p>;
  }
  return (
    <>
      {feel.rows.length === 0 ? (
        <p className="muted small">W ostatnich {feel.period} dniach nie ma wpisów objawów w dniach, w których była używana tylko ta odmiana ({feel.useDays} {dayWord(feel.useDays)} z użyciem).</p>
      ) : (
        <table className="feel-table">
          <caption className="sr-only">Średnie objawów (0–10) z ostatnich {feel.period} dni</caption>
          <thead><tr><th scope="col">Objaw</th><th scope="col">Z tą odmianą</th><th scope="col">Bez zużycia</th></tr></thead>
          <tbody>
            {feel.rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.custom ? <span className="dn">{r.label}</span> : r.label}</th>
                <td><Cell cell={r.with} min={feel.minDays} /></td>
                <td><Cell cell={r.without} min={feel.minDays} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted small">
        Średnie z Twojego dziennika z ostatnich {feel.period} dni (0–10), od {feel.minDays} dni w grupie. „Z tą odmianą” to dni, w których była używana tylko ona;
        sen zestawiamy z poprzednim dniem. Dni z kilkoma odmianami pomijamy.
        To obserwacje własne, nie porada ani ocena skuteczności. Zmiany leczenia omawiaj z lekarzem.
      </p>
      <p className="small"><Link className="btn text" href="/obserwacje">Wszystkie obserwacje</Link></p>
    </>
  );
}
