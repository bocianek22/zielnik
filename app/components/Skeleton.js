// Szkielet listy na czas wczytywania strony: wiersze w kształcie .list-row (tytuł, linia meta, liczba po prawej)
export default function Skeleton({ rows = 4 }) {
  return (
    <div className="list skeleton" role="status" aria-busy="true" aria-label="Wczytywanie">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="list-row skel-row">
          <div className="lr-main">
            <span className="skel-line w60" />
            <span className="skel-line w30" />
          </div>
          <span className="skel-line skel-val" />
        </div>
      ))}
    </div>
  );
}
