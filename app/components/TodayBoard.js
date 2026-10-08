'use client';
import { useMemo } from 'react';
import Icon from './Icon';
import TodayPanel from './TodayPanel';
import { useHome } from './HomeStore';

// liczby w interfejsie: polski przecinek dziesiętny, najwyżej 2 miejsca
const n2 = (x) => Number(Number(x).toFixed(2)).toLocaleString('pl-PL');

// Panel „Dziś” z lekkich danych serwera i wspólnego stanu (HomeStore); nie czeka na listę odmian.
export default function TodayBoard({ usage = { perDay: 0, perDayMl: 0, cost: 0 }, bought = { grams: 0, ml: 0, cost: 0 },
  prescriptions = { items: [], total: 0, urgent: false }, symptoms = null, noUse = false }) {
  const { boughtU, series, recent, stock: stockU, remaining: remainingU, mine, low, limit, savePref, setLow, setLimit, entrySaved } = useHome();
  const dailyUse = usage.perDay; // g/dzień (susz); ml/dzień: usage.perDayMl
  const boughtG = boughtU.g;
  const totalRemaining = remainingU.g;
  const totalStock = stockU.g;
  const daysLeft = dailyUse > 0 && totalStock > 0 ? Math.floor(totalStock / dailyUse) : null;
  // szybkie „Zużyłem” w panelu: ostatnio używana odmiana, którą nadal masz
  const quick = useMemo(() => {
    const q = recent.find((x) => Number(x.current) > 0);
    return q ? { id: q.id, name: q.name, form: q.form, current: Number(q.current) } : null;
  }, [recent]);
  const onUsed = (id, en) => entrySaved(id, en, { name: quick?.name, form: quick?.form, prev: quick?.current });

  // POM-20: pusty panel (nic nie mam, nic nie zużyłem) ma jedną akcję: bez własnych odmian „Dodaj odmianę”, z odmianami bez stanu „Wpisz stan”
  const fresh = mine === 0 || (stockU.g + stockU.ml === 0 && recent.length === 0);
  const onAdd = () => {
    if (mine === 0) { window.dispatchEvent(new Event('zielnik:new-strain')); return; }
    const h = document.getElementById('odmiany');
    h?.scrollIntoView({ block: 'start' });
    h?.focus({ preventScroll: true });
  };

  if (series.length === 0) return null;
  return (
      <TodayPanel stock={stockU} dailyUse={{ g: dailyUse, ml: usage.perDayMl || 0 }} bought={boughtU} low={low} series={series} prescriptions={prescriptions} symptoms={symptoms} noUse={noUse}
        quick={quick} onUsed={onUsed} fresh={fresh} hasOwn={mine > 0} onAdd={onAdd} settings={(
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
