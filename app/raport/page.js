import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql, ensureDb } from '@/lib/db';
import { canUse } from '@/lib/plans';
import { EFFECTS } from '@/lib/effects';
import Header from '../components/Header';
import Icon from '../components/Icon';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

const iso = (d) => d.toISOString().slice(0, 10);
const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(Date.parse(v));
const nf = (n, max = 1) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: max });
const day = (v) => new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

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
  const today = new Date();
  const to = validDate(sp.to) ? sp.to : iso(today);
  const from = validDate(sp.from) ? sp.from : iso(new Date(today.getTime() - 30 * 864e5));
  const withNotes = sp.notes === '1';

  const usage = await q`SELECT s.name, s.producer, s.thc::float8 AS thc, s.cbd::float8 AS cbd, SUM(l.grams)::float8 AS grams,
      COUNT(DISTINCT (l.created_at AT TIME ZONE 'Europe/Warsaw')::date)::int AS days
    FROM usage_log l JOIN strains s ON s.id = l.strain_id
    WHERE l.user_id = ${me.id} AND (l.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${from}::date AND ${to}::date
    GROUP BY s.id ORDER BY grams DESC`;
  const weekly = await q`SELECT to_char(date_trunc('week', l.created_at AT TIME ZONE 'Europe/Warsaw'), 'DD.MM') AS week, SUM(l.grams)::float8 AS grams
    FROM usage_log l WHERE l.user_id = ${me.id} AND (l.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${from}::date AND ${to}::date
    GROUP BY date_trunc('week', l.created_at AT TIME ZONE 'Europe/Warsaw') ORDER BY date_trunc('week', l.created_at AT TIME ZONE 'Europe/Warsaw')`;
  const purchases = await q`SELECT strain_name AS name, grams::float8 AS grams, cost::float8 AS cost,
      to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS at
    FROM purchases WHERE user_id = ${me.id} AND (created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${from}::date AND ${to}::date ORDER BY created_at`;
  const feel = await q`SELECT s.name, us.effects, us.rating::float8 AS rating, us.notes
    FROM user_strain us JOIN strains s ON s.id = us.strain_id
    WHERE us.user_id = ${me.id} AND s.id IN (SELECT strain_id FROM usage_log WHERE user_id = ${me.id}
      AND (created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${from}::date AND ${to}::date) ORDER BY s.name`;

  const [sym] = await q`SELECT COUNT(*)::int AS days, AVG(pain)::float8 AS pain, AVG(sleep)::float8 AS sleep, AVG(anxiety)::float8 AS anxiety, AVG(mood)::float8 AS mood
    FROM symptom_log WHERE user_id = ${me.id} AND day BETWEEN ${from}::date AND ${to}::date`;
  const av = (v) => (v == null ? '–' : nf(v));
  const total = usage.reduce((a, u) => a + u.grams, 0);
  const daysSpan = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1);
  const bought = purchases.reduce((a, p) => a + p.grams, 0);
  const cost = purchases.reduce((a, p) => a + (p.cost || 0), 0);
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
            <dl className="stat-strip">
              <div><dt>Zużycie</dt><dd><b>{nf(total, 2)}</b> g</dd></div>
              <div><dt>Średnio</dt><dd><b>{nf(total / daysSpan, 2)}</b> g/dzień</dd></div>
              <div><dt>Wykupiono</dt><dd><b>{nf(bought, 2)}</b> g{cost > 0 && <span className="stat-sub">ok. {nf(cost, 2)} zł</span>}</dd></div>
            </dl>
          </div>
          <p className="muted small">Liczba użytych odmian: {usage.length}.</p>

          <h3>Zużycie według odmian</h3>
          {usage.length === 0 ? <p className="muted">Brak zapisanego zużycia w tym okresie.</p> : (
            <>
              <ul className="list report-narrow">
                {usage.map((u, i) => (
                  <li key={i} className="list-row"><span className="lr-main">{u.name}<span className="lr-sub">{meta(u)}</span></span><span className="lr-value">{nf(u.grams, 2)} g</span></li>
                ))}
              </ul>
              <div className="table-wrap report-wide"><table className="cmp"><thead><tr><th>Odmiana</th><th>Producent</th><th>THC</th><th>CBD</th><th>Dni użycia</th><th>Razem</th></tr></thead>
                <tbody>{usage.map((u, i) => (<tr key={i}><td>{u.name}</td><td>{u.producer}</td><td>{u.thc != null ? `${nf(u.thc)}%` : '–'}</td><td>{u.cbd != null ? `${nf(u.cbd)}%` : '–'}</td><td>{u.days}</td><td>{nf(u.grams, 2)} g</td></tr>))}</tbody></table></div>
            </>
          )}

          {weekly.length > 0 && (<><h3>Zużycie tygodniowe</h3>
            <dl className="facts report-narrow">{weekly.map((w) => <div key={w.week}><dt>Tydzień od {w.week}</dt><dd>{nf(w.grams, 2)} g</dd></div>)}</dl>
            <div className="table-wrap report-wide"><table className="cmp"><thead><tr><th>Tydzień od</th><th>Gramy</th></tr></thead>
              <tbody>{weekly.map((w) => <tr key={w.week}><td>{w.week}</td><td>{nf(w.grams, 2)} g</td></tr>)}</tbody></table></div></>)}

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
                <li key={i} className="list-row"><span className="lr-main">{p.name}<span className="lr-sub">{day(p.at)}</span></span><span className="lr-value">{nf(p.grams, 2)} g{p.cost != null && <small>{nf(p.cost, 2)} zł</small>}</span></li>
              ))}
            </ul>
            <div className="table-wrap report-wide"><table className="cmp"><thead><tr><th>Data</th><th>Odmiana</th><th>Ilość</th><th>Koszt</th></tr></thead>
              <tbody>{purchases.map((p, i) => <tr key={i}><td>{day(p.at)}</td><td>{p.name}</td><td>{nf(p.grams, 2)} g</td><td>{p.cost != null ? `${nf(p.cost, 2)} zł` : '–'}</td></tr>)}</tbody></table></div></>)}

          {feel.length > 0 && (<><h3>Odczucia pacjenta (skala 0–10)</h3>
            <ul className="list report-narrow">
              {feel.map((f, i) => (
                <li key={i} className="list-row"><span className="lr-main">{f.name}<span className="lr-sub">{feelLine(f) || 'Brak ocen odczuć'}</span>{withNotes && f.notes && <span className="lr-sub">{f.notes}</span>}</span><span className="lr-value">{f.rating != null ? nf(f.rating) : '–'}</span></li>
              ))}
            </ul>
            <div className="table-wrap report-wide"><table className="cmp"><thead><tr><th>Odmiana</th><th>Ocena</th>{EFFECTS.map(([, l]) => <th key={l}>{l}</th>)}{withNotes && <th>Spostrzeżenia</th>}</tr></thead>
              <tbody>{feel.map((f, i) => (<tr key={i}><td>{f.name}</td><td>{f.rating != null ? nf(f.rating) : '–'}</td>{EFFECTS.map(([k]) => <td key={k}>{fx(f.effects, k) != null ? nf(fx(f.effects, k)) : '–'}</td>)}{withNotes && <td>{f.notes || '–'}</td>}</tr>))}</tbody></table></div></>)}
        </section>
        <p className="muted small no-print"><Link href="/historia">Historia zakupów i zużycia</Link></p>
      </main>
    </>
  );
}
