// POM-08: delikatna informacja o regularności wpisów w dzienniku (komponent serwerowy, bez JS po stronie klienta).
// Bez „zerwania serii” i bez zachęt; przy braku wpisów z ostatnich 7 dni nie pokazuje nic. Odznaki (UI 5 etap 5,
// docs/UI-5.md) są osobno w karcie „Twój tydzień” (WeekCard.js).
// Tekst celowo bez słów o temacie (tryb dyskretny); kropka pełna = wpis, pusta = brak (kształt, nie tylko kolor).
const plural = (n, one, many) => (n === 1 ? one : many);

export default function SymptomStreak({ data, className = '' }) {
  if (!data || (data.streak === 0 && data.weekCount === 0)) return null;
  const { streak, week, weekCount } = data;
  const text = streak >= 2 ? `${streak} dni z rzędu` : `${weekCount} z ostatnich 7 dni`;
  const label = `Ostatnie 7 dni: wpis w ${weekCount} ${plural(weekCount, 'dniu', 'dniach')}`;
  return (
    <p className={`streak ${className}`.trim()} data-testid="streak">
      <span className="streak-dots" role="img" aria-label={label}>
        {week.map((d) => <i key={d.day} className={d.on ? 'on' : undefined} aria-hidden="true" />)}
      </span>
      <span className="streak-text">Wpisy: <b>{text}</b></span>
    </p>
  );
}
