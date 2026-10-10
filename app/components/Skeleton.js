// Szkielety na czas wczytywania strony, w kształcie docelowej treści (bez przeskoku po wczytaniu):
//  list   - wiersze .list-row (tytuł, linia meta, liczba po prawej); rows = liczba wierszy
//  detail - nagłówek (hero) i trzy kafle ocen, pod nimi karty
//  cards  - karty z nagłówkiem sekcji i kilkoma liniami
//  screen - neutralny nagłówek ekranu (hero obszaru) i dwie karty: domyślny szkielet app/loading.js dla wszystkich ekranów
// Pasek górny i dolny dokłada LoadingShell.js.
const Line = ({ w = '', h }) => <span className={`skel-line ${w}`.trim()} style={h ? { height: h } : undefined} />;

function Cards({ n = 2 }) {
  return Array.from({ length: n }).map((_, i) => (
    <div key={i} className="card skel-card">
      <div className="skel-head"><span className="skel-dot" /><Line w="w40" /></div>
      <Line /><Line w="w80" /><Line w="w60" />
    </div>
  ));
}

export default function Skeleton({ rows = 4, variant = 'list' }) {
  let body;
  if (variant === 'detail') {
    body = (
      <>
        <div className="skel-hero detail" />
        <div className="skel-kpis">{[0, 1, 2].map((i) => <div key={i} className="skel-kpi" />)}</div>
        <Cards n={2} />
      </>
    );
  } else if (variant === 'screen') {
    body = <><div className="skel-hero neutral" /><Cards n={2} /></>;
  } else if (variant === 'cards') {
    body = <Cards n={rows > 3 ? 3 : rows} />;
  } else {
    body = (
      <div className="list">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="list-row skel-row">
            <span className="skel-dot" />
            <div className="lr-main"><Line w="w60" /><Line w="w30" /></div>
            <span className="skel-line skel-val" />
          </div>
        ))}
      </div>
    );
  }
  return <div className={`skeleton sk-${variant}`} role="status" aria-busy="true" aria-label="Wczytywanie">{body}</div>;
}
