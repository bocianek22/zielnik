import SecHead from '../SecHead';
import Frame from './Frame';
import HBars from './HBars';
import { plural } from './fmt';

// Pora przyjęcia (A5): ile wpisów „Zużyłem” przypada na rano / w ciągu dnia / wieczorem / w nocy (ostatnie 90 dni). Cztery paski w
// jednym kolorze, liczba wpisów i procent na końcu. Opis nawyku, bez ocen i bez porównań; liczba wpisów, nie ilość (g i ml się nie
// mieszają). Serwerowy, bez stanu. `periods`: wynik usagePeriods (lib/usage-calendar.js); bez wpisów nic nie rysuje.
export default function Periods({ periods }) {
  const { rows, total, days } = periods;
  if (total === 0) return null;
  const max = Math.max(...rows.map((r) => r.n));
  const pct = (n) => Math.round((n / total) * 100);
  return (
    <>
      <SecHead cat="stock" icon="clock">Pora przyjęcia, {days} dni</SecHead>
      <Frame className="card per" title={`${total} ${plural(total, 'wpis', 'wpisy', 'wpisów')} „Zużyłem” wg pory dnia`} titleTag="p" titleClass="per-title"
        axis={<p className="per-note">Pora z zapisu albo z godziny wpisu. Liczone są wpisy, nie ilość.</p>}>
        <HBars className="per-bars" max={max}
          items={rows.map((r) => ({ key: r.key, label: r.label, value: r.n, tone: 'data', text: `${r.n} (${pct(r.n)}%)` }))} />
      </Frame>
    </>
  );
}
