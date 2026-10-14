import { fmtNum } from '@/lib/units';

const dayWord = (n) => (n === 1 ? 'dzień' : 'dni');

// POM-47: opis, nie ocena: bez kolorów lepiej/gorzej i bez kolejności według różnicy; poniżej progu tylko liczba dni
function Cell({ cell, min }) {
  return cell.avg != null
    ? <><b>{fmtNum(cell.avg, 1)}</b><span>{cell.days} {dayWord(cell.days)}</span></>
    : <><b className="few">–</b><span>{cell.days} {dayWord(cell.days)}, za mało (min. {min})</span></>;
}

export default function FactorsObs({ data }) {
  const shown = data.factors.filter((f) => f.rows.length);
  if (!shown.length) {
    return <p className="muted small">Zaznaczaj czynniki dnia w dzienniku (np. stres, ruch), a zobaczysz tu średnie objawów w dniach z nimi i bez nich.</p>;
  }
  return (
    <div className="stack">
      {shown.map((f) => (
        <section key={f.id} className="card" aria-labelledby={`fo-${f.id}`}>
          <h3 id={`fo-${f.id}`} className="dn">{f.name}</h3>
          <table className="feel-table">
            <caption className="sr-only">Średnie objawów (0–10) w dniach z czynnikiem i bez niego, ostatnie {data.period} dni</caption>
            <thead><tr><th scope="col">Objaw</th><th scope="col">Z czynnikiem</th><th scope="col">Bez niego</th></tr></thead>
            <tbody>
              {f.rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{r.custom ? <span className="dn">{r.label}</span> : r.label}</th>
                  <td><Cell cell={r.with} min={data.minDays} /></td>
                  <td><Cell cell={r.without} min={data.minDays} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className="muted small">„Bez niego” to dni z wpisem objawów, w których czynnik nie był zaznaczony, liczone od pierwszego zaznaczenia. Sen zestawiamy z czynnikiem z poprzedniego dnia. To obserwacje własne, nie ocena ani porada.</p>
    </div>
  );
}
