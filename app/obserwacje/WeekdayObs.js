'use client';
import { useState } from 'react';
import { fmtNum } from '@/lib/units';
import HBars from '../components/charts/HBars';

const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const NAMES = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
const dayWord = (n) => (n === 1 ? 'dzień' : 'dni');

// POM-54: średnia objawu w każdy dzień tygodnia. Opis, nie ocena: stała kolejność Pn–Nd, neutralny kolor,
// bez wyróżniania „najlepszego” dnia. Nazwy własnych objawów rozmyte w trybie dyskretnym.
export default function WeekdayObs({ data }) {
  const [key, setKey] = useState(data.symptoms[0]?.key);
  const s = data.symptoms.find((x) => x.key === key) || data.symptoms[0];
  if (!s) return <p className="muted small">Gdy w dzienniku będą wpisy z kilku tygodni, zobaczysz tu średnie objawów w poszczególne dni tygodnia.</p>;
  const few = s.days.every((c) => c.avg == null);
  return (
    <section className="card stack weekday-obs" aria-labelledby="wd-h">
      <h3 id="wd-h" className="sr-only">Średnie według dnia tygodnia</h3>
      <div className="seg sym-year-pick" role="group" aria-label="Objaw w układzie tygodnia">
        {data.symptoms.map((x) => (
          <button key={x.key} type="button" aria-pressed={x.key === s.key} className={x.key === s.key ? 'on' : ''} onClick={() => setKey(x.key)}>
            <span className={x.custom ? 'dn' : undefined}>{x.label}</span>
          </button>
        ))}
      </div>
      <div aria-hidden="true">
        <HBars className="wd-bars" max={10} items={s.days.map((c, i) => ({
          key: i, label: WEEKDAYS[i], value: c.avg, tone: 'data', text: c.avg != null ? fmtNum(c.avg, 1) : `– (${c.days} ${dayWord(c.days)})`,
        }))} />
      </div>
      <table className="sr-only">
        <caption>{s.custom ? <span className="dn">{s.label}</span> : s.label}: średnia 0–10 według dnia tygodnia, ostatnie {data.period} dni</caption>
        <thead><tr><th scope="col">Dzień</th><th scope="col">Średnia</th><th scope="col">Liczba dni</th></tr></thead>
        <tbody>
          {s.days.map((c, i) => (
            <tr key={i}><th scope="row">{NAMES[i]}</th><td>{c.avg != null ? fmtNum(c.avg, 1) : `za mało (min. ${data.minDays})`}</td><td>{c.days}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        Średnią pokazujemy od {data.minDays} dni w danym dniu tygodnia; przy mniejszej liczbie w nawiasie liczba dni.
        {few && data.period < 90 && ' Wybierz dłuższy okres (90 dni), aby zebrać więcej dni.'} Sen przypisujemy do dnia wpisu (noc przed nim). To opis Twoich zapisów, nie ocena.
      </p>
    </section>
  );
}
