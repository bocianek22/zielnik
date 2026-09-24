// Prosty "szkielet" karty na czas wczytywania strony (mniej odczuwalne opóźnienie na telefonie)
export default function Skeleton({ rows = 3 }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Wczytywanie">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card skel">
          <div className="skel-line w60" />
          <div className="skel-line w30" />
          <div className="skel-line w80" />
        </div>
      ))}
    </div>
  );
}
