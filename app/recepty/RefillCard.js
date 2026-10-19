import Icon from '../components/Icon';
import { longDay, num as n2 } from '../components/charts/fmt';
import { refillPlan } from '@/lib/refill-plan';

// Plan wykupu w Receptach (komponent serwerowy): dla suszu i oleju/pena osobno data „kup najpóźniej”, koniec zapasu
// i recepta, z której można wykupić. Liczone z tempa 30 dni; bez zapisów zużycia nie ma czego planować (karta znika).
const STATUS = {
  ok: { tone: 'ok', label: 'Recepta jest' },
  'rx-first': { tone: 'warn', label: 'Recepta wygaśnie wcześniej' },
  'need-rx': { tone: 'warn', label: 'Brak ważnej recepty' },
};

export default function RefillCard({ stock, perDay, rx, today }) {
  const plans = ['g', 'ml'].map((u) => refillPlan({ unit: u, stock: stock[u], perDay: perDay[u], rx, today })).filter((p) => p && stock[p.unit] > 0);
  if (!plans.length) return null;
  return (
    <section className="card refill" data-cat="rx" id="plan-wykupu" aria-labelledby="refill-h">
      <h2 className="sec-head" id="refill-h"><span className="ic-dot sm"><Icon name="cart" size={18} /></span>Plan wykupu</h2>
      <ul className="refill-list">
        {plans.map((p) => {
          const st = STATUS[p.status];
          const when = p.daysToBuy === 0 ? 'dziś' : p.daysToBuy === 1 ? 'jutro' : longDay(p.buyBy);
          return (
            <li key={p.unit} className={`refill-row ${st.tone}`}>
              <p className="refill-unit">{plans.length > 1 ? (p.unit === 'ml' ? 'Olej i pen' : 'Susz') : 'Twój zapas'}<span className={`pill sm refill-st ${st.tone}`}>{st.label}</span></p>
              {p.status === 'need-rx' ? (
                <p className="refill-main">Nowa recepta przed <b>{longDay(p.runOut)}</b></p>
              ) : (
                <p className="refill-main">Wykup najpóźniej <b>{when}</b></p>
              )}
              <p className="refill-sub">
                {p.daysLeft === 0 ? 'Zapas kończy się dziś' : <>Zapas starczy do {longDay(p.runOut)} ({p.daysLeft} {p.daysLeft === 1 ? 'dzień' : 'dni'})</>}
                {p.rx && <> · na recepcie {n2(p.rx.remaining)} {p.unit}, ważna do {longDay(p.rx.validUntil)}</>}
              </p>
              {/* plik .ics z przypomnieniem dzień wcześniej; zwykły link, więc działa też w aplikacji bez JavaScriptu */}
              <a className="refill-cal" href={p.status === 'need-rx' ? `/api/calendar?typ=recepta&dzien=${p.runOut}` : `/api/calendar?typ=wykup&dzien=${p.buyBy}`} download>
                <Icon name="calendar" size={16} />Dodaj do kalendarza</a>
            </li>
          );
        })}
      </ul>
      <p className="muted small">Liczone z Twojego tempa z ostatnich 30 dni. Zostawiamy 5 dni zapasu na dojazd i niedostępność w aptece.</p>
    </section>
  );
}
