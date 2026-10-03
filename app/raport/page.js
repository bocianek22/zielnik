import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql, ensureDb } from '@/lib/db';
import { canUse } from '@/lib/plans';
import { EFFECTS } from '@/lib/effects';
import Header from '../components/Header';
import Icon from '../components/Icon';
import PrintButton from './PrintButton';
import { formatDay, todayPL, addDaysIso } from '@/lib/date';
import { doctorReport } from '@/lib/report';

export const dynamic = 'force-dynamic';

const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(Date.parse(v));
const nf = (n, max = 1) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: max });
const day = formatDay;

export default async function Raport({ searchParams }) {
  const me = await getUser();
  if (!me) redirect('/login');
  if (me.must_change_password) redirect('/change-password');
  await ensureDb();
  const q = sql();
  const [plan] = await q`SELECT plan, plan_until, display_name FROM users WHERE id = ${me.id}`;
  if (!canUse(plan, 'doctor_report')) {
    return (<><Header user={me} /><main className="page"><h1>Raport dla lekarza</h1><div className="card empty">
      <Icon name="file" size={32} />
      <h2>Funkcja planu Premium</h2>
      <p>Raport zestawia zużycie, zakupy i objawy z wybranego okresu do wydruku lub zapisu jako PDF.</p>
      <Link className="btn ghost" href="/premium">Zobacz plan Premium</Link></div></main></>);
  }

  const sp = await searchParams;
  const today = todayPL(); // dzień w czasie polskim (POM-01), nie UTC
  const to = validDate(sp.to) ? sp.to : today;
  const from = validDate(sp.from) ? sp.from : addDaysIso(to, -30);
  const withNotes = sp.notes === '1';

  const { usage, weekly, purchases, feel, sym, totals } = await doctorReport(me.id, from, to);
  const av = (v) => (v == null ? '–' : nf(v));
  const daysSpan = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1);
  const { used, bought, cost } = totals;
  // gramy (susz) i ml (olej, pen) zawsze osobno; ml tylko gdy są wpisy w ml
  const hasMl = used.ml > 0 || bought.ml > 0;
  const units = [(!hasMl || used.g > 0 || bought.g > 0) && 'g', hasMl && 'ml'].filter(Boolean);
  const uLabel = { g: 'susz', ml: 'olej i pen' };
  const hasMlWeek = weekly.some((w) => w.ml > 0);
  const hasGWeek = !hasMlWeek || weekly.some((w) => w.grams > 0);
  const weekText = (w) => [hasGWeek && `${nf(w.grams, 2)} g`, hasMlWeek && `${nf(w.ml, 2)} ml`].filter(Boolean).join(', ');
  const fx = (o, k) => (o && o[k] != null ? o[k] : null);
  const meta = (u) => [u.producer, u.thc != null && `THC ${nf(u.thc)}%`, u.cbd != null && `CBD ${nf(u.cbd)}%`, `${u.days} ${u.days === 1 ? 'dzień' : 'dni'} użycia`].filter(Boolean).join(' · ');
  const feelLine = (f) => EFFECTS.map(([k, l]) => (fx(f.effects, k) != null ? `${l} ${nf(fx(f.effects, k))}` : null)).filter(Boolean).join(' · ');

  return (
    <>
      <Header user={me} />
      <main className="page stack report-page">
        <h1 className="no-print">Raport dla lekarza</h1>
        <form className="card row report-filter no-print" method="get">
          <div className="field"><label htmlFor="from">Od</label><input id="from" name="from" type="date" className="input" defaultValue={from} /></div>
          <div className="field"><label htmlFor="to">Do</label><input id="to" name="to" type="date" className="input" defaultValue={to} /></div>
          <label className="check"><input type="checkbox" name="notes" value="1" defaultChecked={withNotes} /> Dołącz moje spostrzeżenia</label>
          <button className="btn ghost">Odśwież</button>
          <PrintButton />
        </form>

        <section className="card report-sheet">
          <h2>Zestawienie stosowania medycznej konopi</h2>
          <p className="report-meta">Pacjent: <b>{plan?.display_name || me.username}</b>. Okres: <b>{day(from)}</b> do <b>{day(to)}</b> ({daysSpan} dni).</p>
          <p className="muted small">Zestawienie powstało z zapisów prowadzonych przez pacjenta w aplikacji Zielnik. Nie jest dokumentacją medyczną.</p>

          <h3>Podsumowanie</h3>
          <div className="summary">
            {units.map((u, i) => (
              <dl key={u} className="stat-strip">
                <div><dt>Zużycie{units.length > 1 && `, ${uLabel[u]}`}</dt><dd><b>{nf(used[u], 2)}</b> {u}</dd></div>
                <div><dt>Średnio na dzień</dt><dd><b>{nf(used[u] / daysSpan, 2)}</b> {u}</dd></div>
                <div><dt>Wykupiono</dt><dd><b>{nf(bought[u], 2)}</b> {u}{i === units.length - 1 && cost > 0 && <span className="stat-sub">łącznie ok. {nf(cost, 2)} zł</span>}</dd></div>
              </dl>
            ))}
          </div>
          <p className="muted small">Liczba użytych odmian: {usage.length}.</p>

          <h3>Zużycie według odmian</h3>
          {usage.length === 0 ? <p className="muted">Brak zapisanego zużycia w tym okresie.</p> : (
            <>
              <ul className="list report-narrow">
                {usage.map((u, i) => (
                  <li key={i} className="list-row"><span className="lr-main"><span className="dn">{u.name}</span><span className="lr-sub">{meta(u)}</span></span><span className="lr-value">{nf(u.grams, 2)} {u.unit}</span></li>
                ))}
              </ul>
              <div className="table-wrap report-wide"><table className="cmp"><thead><tr><th>Odmiana</th><th>Producent</th><th>THC</th><th>CBD</th><th>Dni użycia</th><th>Razem (g / ml)</th></tr></thead>
                <tbody>{usage.map((u, i) => (<tr key={i}><td><span className="dn">{u.name}</span></td><td><span className="dn">{u.producer}</span></td><td>{u.thc != null ? `${nf(u.thc)}%` : '–'}</td><td>{u.cbd != null ? `${nf(u.cbd)}%` : '–'}</td><td>{u.days}</td><td>{nf(u.grams, 2)} {u.unit}</td></tr>))}</tbody></table></div>
            </>
          )}

          {weekly.length > 0 && (<><h3>Zużycie tygodniowe</h3>
            <dl className="facts report-narrow">{weekly.map((w) => <div key={w.week}><dt>Tydzień od {w.week}</dt><dd>{weekText(w)}</dd></div>)}</dl>
            <div className="table-wrap report-wide"><table className="cmp"><thead><tr><th>Tydzień od</th>{hasGWeek && <th>Susz (g)</th>}{hasMlWeek && <th>Olej i pen (ml)</th>}</tr></thead>
              <tbody>{weekly.map((w) => <tr key={w.week}><td>{w.week}</td>{hasGWeek && <td>{nf(w.grams, 2)} g</td>}{hasMlWeek && <td>{nf(w.ml, 2)} ml</td>}</tr>)}</tbody></table></div></>)}

          {sym.days > 0 && (<><h3>Dziennik objawów</h3>
            <p className="muted small">Średnie z {sym.days} {sym.days === 1 ? 'dnia' : 'dni'} wpisów, skala 0–10.</p>
            <dl className="facts report-narrow">
              <div><dt>Ból</dt><dd>{av(sym.pain)}</dd></div><div><dt>Jakość snu</dt><dd>{av(sym.sleep)}</dd></div>
              <div><dt>Lęk</dt><dd>{av(sym.anxiety)}</dd></div><div><dt>Nastrój</dt><dd>{av(sym.mood)}</dd></div>
            </dl>
            <div className="table-wrap report-wide"><table className="cmp"><thead><tr><th>Ból</th><th>Jakość snu</th><th>Lęk</th><th>Nastrój</th></tr></thead>
              <tbody><tr><td>{av(sym.pain)}</td><td>{av(sym.sleep)}</td><td>{av(sym.anxiety)}</td><td>{av(sym.mood)}</td></tr></tbody></table></div>
            <p className="muted small">Ból i lęk: wyższa wartość oznacza gorzej. Sen i nastrój: wyższa wartość oznacza lepiej.</p></>)}

          {purchases.length > 0 && (<><h3>Zakupy</h3>
            <ul className="list report-narrow">
              {purchases.map((p, i) => (
                <li key={i} className="list-row"><span className="lr-main"><span className="dn">{p.name}</span><span className="lr-sub">{day(p.at)}</span></span><span className="lr-value">{nf(p.grams, 2)} {p.unit}{p.cost != null && <small>{nf(p.cost, 2)} zł</small>}</span></li>
              ))}
            </ul>
            <div className="table-wrap report-wide"><table className="cmp"><thead><tr><th>Data</th><th>Odmiana</th><th>Ilość (g / ml)</th><th>Koszt</th></tr></thead>
              <tbody>{purchases.map((p, i) => <tr key={i}><td>{day(p.at)}</td><td><span className="dn">{p.name}</span></td><td>{nf(p.grams, 2)} {p.unit}</td><td>{p.cost != null ? `${nf(p.cost, 2)} zł` : '–'}</td></tr>)}</tbody></table></div></>)}

          {feel.length > 0 && (<><h3>Odczucia pacjenta (skala 0–10)</h3>
            <ul className="list report-narrow">
              {feel.map((f, i) => (
                <li key={i} className="list-row"><span className="lr-main"><span className="dn">{f.name}</span><span className="lr-sub">{feelLine(f) || 'Brak ocen odczuć'}</span>{withNotes && f.notes && <span className="lr-sub">{f.notes}</span>}</span><span className="lr-value">{f.rating != null ? nf(f.rating) : '–'}</span></li>
              ))}
            </ul>
            <div className="table-wrap report-wide"><table className="cmp"><thead><tr><th>Odmiana</th><th>Ocena</th>{EFFECTS.map(([, l]) => <th key={l}>{l}</th>)}{withNotes && <th>Spostrzeżenia</th>}</tr></thead>
              <tbody>{feel.map((f, i) => (<tr key={i}><td><span className="dn">{f.name}</span></td><td>{f.rating != null ? nf(f.rating) : '–'}</td>{EFFECTS.map(([k]) => <td key={k}>{fx(f.effects, k) != null ? nf(fx(f.effects, k)) : '–'}</td>)}{withNotes && <td>{f.notes || '–'}</td>}</tr>))}</tbody></table></div></>)}
        </section>
        <p className="muted small no-print"><Link href="/historia">Historia zakupów i zużycia</Link></p>
      </main>
    </>
  );
}
