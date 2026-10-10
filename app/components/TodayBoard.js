'use client';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import TodayPanel, { unitsOf } from './TodayPanel';
import QuickActions from './QuickActions';
import { unitOf } from '@/lib/units';
import { plural } from './charts/fmt';
import { useHome } from './HomeStore';
import { daysLeft as daysOf, widgetPayload } from '@/lib/widget';
import { widgetSet } from './native/bridge';

// liczby w interfejsie: polski przecinek dziesiętny, najwyżej 2 miejsca
const n2 = (x) => Number(Number(x).toFixed(2)).toLocaleString('pl-PL');


const isFresh = (mine, stock, recent) => mine === 0 || (stock.g + stock.ml === 0 && recent.length === 0);
// ostatnio używana odmiana, którą nadal masz (cel szybkiego „Zużyłem” i „Wykupiłem”)
const quickOf = (recent) => {
  const q = recent.find((x) => Number(x.current) > 0);
  return q ? { id: q.id, name: q.name, form: q.form, current: Number(q.current) } : null;
};

// Pierścień dni zapasu: łuk = dni z 30 (pełny od 30 dni wzwyż); opis dla czytnika w aria-label, rysunek jest dekoracją
function Ring({ days, what }) {
  const R = 52, C = 2 * Math.PI * R;
  const frac = days == null ? 0 : Math.min(days, 30) / 30;
  const label = days == null ? `Za mało zapisów, aby policzyć, na ile dni starczy zapasu ${what}` : `Zapasu ${what} starczy na ${days} ${plural(days, 'dzień', 'dni')}`;
  return (
    <div className="hero-ring" role="img" aria-label={label}>
      <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle className="ring-track" cx="60" cy="60" r={R} />
        {frac > 0 && <circle className="ring-arc" cx="60" cy="60" r={R} strokeDasharray={`${(frac * C).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 60 60)" />}
      </svg>
      <p className="ring-text" aria-hidden="true"><b>{days ?? '–'}</b><span>{days == null ? 'dni zapasu' : `${plural(days, 'dzień', 'dni')} zapasu`}</span></p>
    </div>
  );
}

// Wnętrze nagłówka „Dziś”: zapas z pierścieniem dni, drugi zapas (ml) w linii, „Zużyłem” i „Wykupiłem” ostatnio używanej odmiany.
// Bez odmian i bez stanu (pusty panel) nic nie pokazuje: wtedy jest tylko data i tytuł.
export function TodayHero({ usage = { perDay: 0, perDayMl: 0 } }) {
  const { series, recent, stock, mine, entrySaved } = useHome();
  const quick = useMemo(() => quickOf(recent), [recent]);
  if (series.length === 0 || isFresh(mine, stock, recent)) return null;
  const rate = { g: usage.perDay, ml: usage.perDayMl || 0 };
  const [u, other] = unitsOf(stock, rate);
  const what = u === 'ml' ? 'oleju i pena' : 'suszu';
  const d = daysOf(stock[u], rate[u]);
  const dOther = other ? daysOf(stock[other], rate[other]) : null;
  const onUsed = (en) => entrySaved(quick.id, en, { name: quick.name, form: quick.form, prev: quick.current });
  return (
    <>
      <div className="hero-main">
        <Ring days={d} what={what} />
        <div className="hero-fig">
          <h2 className="hero-lbl">Zapas {what}</h2>
          <p className="big-num kpi-big"><b>{n2(stock[u])}</b> <small>{u}</small></p>
          {other && <p className="hero-sub">{other === 'ml' ? 'Olej i pen' : 'Susz'}: {n2(stock[other])} {other}{dOther != null && `, ${dOther} ${plural(dOther, 'dzień', 'dni')}`}</p>}
        </div>
      </div>
      {quick ? (
        <div className="today-quick">
          <QuickActions key={quick.id} idPrefix="today-q" icons strainId={quick.id} name={quick.name} form={quick.form} current={quick.current}
            remaining={0} onSaved={onUsed} />
          <p className="tq-name">Ostatnio używana: <span className="tq-strain"><span className="dn">{quick.name}</span><span className="tq-stock">, mam {n2(quick.current)} {unitOf(quick.form)}</span></span></p>
        </div>
      ) : (
        <div className="today-quick today-quick-links">
          <Link className="btn" href="/odmiany"><Icon name="check" size={20} />Zużyłem</Link>
          <Link className="btn ghost" href="/recepty"><Icon name="cart" size={20} />Wykupiłem</Link>
        </div>
      )}
    </>
  );
}

// Panel „Dziś” z lekkich danych serwera i wspólnego stanu (HomeStore); nie czeka na listę odmian.
export default function TodayBoard({ usage = { perDay: 0, perDayMl: 0, cost: 0 }, bought = { grams: 0, ml: 0, cost: 0 },
  prescriptions = { items: [], total: 0, urgent: false }, symptoms = null, noUse = false }) {
  const { boughtU, series, recent, stock: stockU, remaining: remainingU, mine, low, limit, savePref, setLow, setLimit } = useHome();
  const dailyUse = usage.perDay; // g/dzień (susz); ml/dzień: usage.perDayMl
  const boughtG = boughtU.g;
  const totalRemaining = remainingU.g;
  const totalStock = stockU.g;
  const daysLeft = daysOf(totalStock, dailyUse);
  // Widżet Androida (POM-13): data końca zapasu przy wczytaniu i po każdej zmianie zapasu (także po „Zużyłem”)
  const today = series.at(-1)?.day;
  const perMl = usage.perDayMl || 0;
  useEffect(() => {
    if (today) widgetSet(widgetPayload({ stock: { g: stockU.g, ml: stockU.ml }, dailyUse: { g: dailyUse, ml: perMl }, today }));
  }, [stockU.g, stockU.ml, dailyUse, perMl, today]);
  // najbardziej wyczerpana z ostatnich odmian suszu (próg „Kończy się” z ustawień): kafel i zadanie w panelu
  const lowStrain = useMemo(() => {
    const l = low > 0 ? recent.filter((x) => unitOf(x.form) === 'g' && Number(x.current) > 0 && Number(x.current) <= low).sort((a, b) => a.current - b.current)[0] : null;
    return l ? { name: l.name, current: Number(l.current), unit: 'g' } : null;
  }, [recent, low]);

  // POM-20: pusty panel (nic nie mam, nic nie zużyłem) ma jedną akcję: bez własnych odmian „Dodaj odmianę”, z odmianami bez stanu „Wpisz stan”
  const fresh = isFresh(mine, stockU, recent);
  // lista odmian jest na /odmiany: bez własnych odmian od razu formularz nowej, z odmianami lista (tam „Wpisz stan” w karcie)
  const router = useRouter();
  const onAdd = () => router.push(mine === 0 ? '/odmiany?new=1' : '/odmiany');

  if (series.length === 0) return null;
  return (
      <TodayPanel stock={stockU} dailyUse={{ g: dailyUse, ml: usage.perDayMl || 0 }} forecast={usage.forecast} bought={boughtU} low={low} series={series} prescriptions={prescriptions} symptoms={symptoms} noUse={noUse} lowStrain={lowStrain}
        fresh={fresh} hasOwn={mine > 0} onAdd={onAdd} settings={(
          <details className="prefs">
            <summary>Szczegóły i ustawienia <Icon name="chevronDown" size={18} /></summary>
            <dl className="facts">
              {daysLeft != null && <div><dt>Średnie zużycie{usage.perDayMl > 0 && ' suszu'}</dt><dd>{n2(dailyUse)} g/dzień</dd></div>}
              {usage.perDayMl > 0 && <div><dt>Średnie zużycie oleju i pena</dt><dd>{n2(usage.perDayMl)} ml/dzień</dd></div>}
              {bought.cost > 0 && <div><dt>Koszt wykupu w tym miesiącu</dt><dd>ok. {n2(bought.cost)} zł</dd></div>}
              {limit > 0 && <div><dt>Limit miesięczny (susz)</dt><dd>{n2(limit)} g, zostało {n2(Math.max(limit - boughtG, 0))} g</dd></div>}
              {usage.cost > 0 && <div><dt>Koszt zużycia (30 dni)</dt><dd>{n2(usage.cost)} zł</dd></div>}
              {totalRemaining > 0 && <div><dt>Do wykupienia łącznie{remainingU.ml > 0 && ', susz'}</dt><dd>{n2(totalRemaining)} g</dd></div>}
              {remainingU.ml > 0 && <div><dt>Do wykupienia łącznie, olej i pen</dt><dd>{n2(remainingU.ml)} ml</dd></div>}
            </dl>
            {daysLeft == null && <p className="muted small">Zapisuj zużycie w karcie odmiany („Zużyłem”), a policzę średnie tempo i prognozę, na ile dni starczy zapasu.</p>}
            {(totalRemaining > 0 || remainingU.ml > 0) && <p className="muted small">Odmiany z jednej puli „do wykupienia” liczone są raz.</p>}
            <h3 className="prefs-title">Na tym urządzeniu</h3>
            <div className="row">
              <div className="field"><label htmlFor="pref-low">Próg „Kończy się” dla suszu (g)</label>
                <input id="pref-low" className="input" type="number" min="0" step="0.5" inputMode="decimal" value={low || ''} onChange={savePref('zielnik.low', setLow)} /></div>
              <div className="field"><label htmlFor="pref-limit">Miesięczny limit wykupu suszu (g)</label>
                <input id="pref-limit" className="input" type="number" min="0" step="1" inputMode="numeric" value={limit || ''} onChange={savePref('zielnik.limit', setLimit)} /></div>
            </div>
          </details>
        )} />
  );
}
