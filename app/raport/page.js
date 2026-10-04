import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql, ensureDb } from '@/lib/db';
import { canUse } from '@/lib/plans';
import { EFFECTS } from '@/lib/effects';
import { SYMPTOMS } from '@/lib/symptoms';
import Header from '../components/Header';
import Icon from '../components/Icon';
import PrintButton from './PrintButton';
import VisitPeriod from './VisitPeriod';
import { formatDay, todayPL, addDaysIso } from '@/lib/date';
import { doctorReport, MIN_SYMPTOM_DAYS } from '@/lib/report';

export const dynamic = 'force-dynamic';

const MAX_DAYS = 731; // dłuższy okres skracamy (tabela tygodniowa i wydruk przestają być czytelne)
const validDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(Date.parse(v));
const nf = (n, max = 1) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: max });
const day = formatDay;
const short = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const dni = (n) => `${n} ${n === 1 ? 'dzień' : 'dni'}`;
const dniGen = (n) => `${n} ${n === 1 ? 'dnia' : 'dni'}`;
const av = (v) => (v == null ? '–' : nf(v));
const PRESETS = [[30, '30 dni'], [90, '90 dni']];

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
      <p>Raport zestawia zużycie, zakupy, recepty i objawy z wybranego okresu do wydruku lub zapisu jako PDF.</p>
      <Link className="btn ghost" href="/premium">Zobacz plan Premium</Link></div></main></>);
  }

  const sp = await searchParams;
  const today = todayPL(); // dzień w czasie polskim (POM-01), nie UTC
  let to = validDate(sp.to) ? sp.to : today;
  let from = validDate(sp.from) ? sp.from : addDaysIso(to, -29);
  if (from > to) [from, to] = [to, from];
  if (Date.parse(to) - Date.parse(from) >= MAX_DAYS * 864e5) from = addDaysIso(to, -(MAX_DAYS - 1));
  const withNotes = sp.notes === '1';
  const visit = sp.okres === 'wizyta';
  const notesQs = withNotes ? '&notes=1' : '';

  const { usage, weekly, purchases, feel: feelAll, sym, totals, rx, rxSum, strainSym } = await doctorReport(me.id, from, to);
  // bez pustych wierszy: tylko odmiany z oceną, odczuciem albo (gdy dołączone) spostrzeżeniem
  const feel = feelAll.filter((f) => f.rating != null || EFFECTS.some(([k]) => f.effects?.[k] != null) || (withNotes && f.notes));
  const daysSpan = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
  const { used, bought, cost } = totals;
  // gramy (susz) i ml (olej, pen) zawsze osobno; ml tylko gdy są wpisy w ml
  const hasMl = used.ml > 0 || bought.ml > 0 || rxSum.prescribed.ml > 0;
  const units = [(!hasMl || used.g > 0 || bought.g > 0 || rxSum.prescribed.g > 0) && 'g', hasMl && 'ml'].filter(Boolean);
  const uLabel = { g: 'susz', ml: 'olej i pen' };
  const both = (o) => units.map((u) => `${nf(o[u], 2)} ${u}`).join(' i ');
  const fx = (o, k) => (o && o[k] != null ? o[k] : null);
  const meta = (u) => [u.producer, u.thc != null && `THC ${nf(u.thc)}%`, u.cbd != null && `CBD ${nf(u.cbd)}%`, `${dni(u.days)} użycia`].filter(Boolean).join(' · ');
  const feelLine = (f) => EFFECTS.map(([k, l]) => (fx(f.effects, k) != null ? `${l} ${nf(fx(f.effects, k))}` : null)).filter(Boolean).join(' · ');

  // tydzień po tygodniu
  const weekRange = (w) => (w.start === w.end ? short(w.start) : `${short(w.start)}–${short(w.end)}`);
  // na liście tygodni tylko niezerowe jednostki (w tabeli wydruku są obie kolumny)
  const qty = (g, ml) => units.filter((u) => (u === 'g' ? g : ml) > 0).map((u) => `${nf(u === 'g' ? g : ml, 2)} ${u}`).join(' i ') || 'brak';
  const symLine = (w) => (w.sym_days ? `${dni(w.sym_days)} z wpisem: ${SYMPTOMS.map((s) => `${s.short} ${av(w[s.key])}`).join(', ')}` : 'brak wpisów objawów');
  const anyWeekData = weekly.some((w) => w.use_days || w.sym_days || w.bought_g || w.bought_ml);

  // recepty
  const rxState = (r) => (r.status === 'used' ? 'wykupiona w całości'
    : r.status === 'expired' ? `wygasła, niewykorzystane ${nf(r.remaining, 2)} ${r.unit}`
      : `${r.valid_until ? 'ważna' : 'bez terminu'}, do wykupienia ${nf(r.remaining, 2)} ${r.unit}`);
  const rxUnits = units.filter((u) => rxSum.prescribed[u] > 0);
  const rxQty = (o) => rxUnits.filter((u) => o[u] > 0).map((u) => `${nf(o[u], 2)} ${u}`).join(' i ') || '0';

  // objawy przy odmianach: średnia tylko przy co najmniej MIN_SYMPTOM_DAYS dniach z wpisem
  const symCell = (s, k) => (s[`n_${k}`] >= MIN_SYMPTOM_DAYS ? `${nf(s[k])} (${dniGen(s[`n_${k}`])})` : s[`n_${k}`] ? `za mało dni (${s[`n_${k}`]})` : '–');

  const presetHref = (n) => `/raport?from=${addDaysIso(today, -(n - 1))}&to=${today}${notesQs}`;
  const presetOn = (n) => !visit && to === today && from === addDaysIso(today, -(n - 1));
  const custom = !visit && !PRESETS.some(([n]) => presetOn(n));

  return (
    <>
      <Header user={me} />
      <main className="page stack report-page">
        <h1 className="no-print">Raport dla lekarza</h1>
        <div className="card report-filter no-print">
          <h2 className="section-label">Okres</h2>
          <nav className="chips report-presets" aria-label="Gotowe okresy">
            {PRESETS.map(([n, l]) => (
              <Link key={n} className={`chip${presetOn(n) ? ' on' : ''}`} href={presetHref(n)} aria-current={presetOn(n) ? 'page' : undefined}>{l}</Link>
            ))}
          </nav>
          <VisitPeriod today={today} value={visit ? from : ''} notes={withNotes} />
          <details className="report-more" open={custom || undefined}>
            <summary>Własny zakres dat i opcje<Icon name="chevronDown" size={20} className="report-more-chev" /></summary>
            <form className="row report-range" method="get">
              <div className="field"><label htmlFor="from">Od</label><input id="from" name="from" type="date" className="input" defaultValue={from} max={today} /></div>
              <div className="field"><label htmlFor="to">Do</label><input id="to" name="to" type="date" className="input" defaultValue={to} max={today} /></div>
              <label className="check"><input type="checkbox" name="notes" value="1" defaultChecked={withNotes} /> Dołącz moje spostrzeżenia</label>
              <button className="btn ghost">Pokaż raport</button>
            </form>
          </details>
          <PrintButton from={from} to={to} />
          <p className="muted small">Na telefonie wybierz w oknie drukowania „Zapisz jako PDF”, a potem udostępnij plik. Na wydruku nazwy odmian są widoczne także w trybie dyskretnym.</p>
        </div>

        <section className="card report-sheet">
          <h2>Zestawienie stosowania medycznej konopi</h2>
          <p className="report-meta">Pacjent: <b>{plan?.display_name || me.username}</b><br />Okres: <b>{day(from)}</b> do <b>{day(to)}</b> ({dni(daysSpan)})</p>
          <p className="muted small">Zestawienie powstało {day(today)} z zapisów prowadzonych przez pacjenta w aplikacji Zielnik. Nie jest dokumentacją medyczną ani oceną skuteczności leczenia.</p>

          <h3>Podsumowanie</h3>
          <div className="summary">
            {units.map((u) => (
              <dl key={u} className="stat-strip">
                <div><dt>Zużycie{units.length > 1 && `, ${uLabel[u]}`}</dt><dd><b>{nf(used[u], 2)}</b> {u}</dd></div>
                <div><dt>Średnio na dzień</dt><dd><b>{nf(used[u] / daysSpan, 2)}</b> {u}</dd></div>
                <div><dt>Wykupiono</dt><dd><b>{nf(bought[u], 2)}</b> {u}</dd></div>
              </dl>
            ))}
          </div>
          <p className="muted small">Liczba użytych odmian: {usage.length}. Dni z wpisem objawów: {sym.days} z {daysSpan}.{cost > 0 && ` Koszt zakupów: ok. ${nf(cost, 2)} zł.`}</p>

          <h3>Tydzień po tygodniu</h3>
          {!anyWeekData ? <p className="muted">Brak zapisów w tym okresie.</p> : (
            <>
              <ul className="list report-narrow">
                {weekly.map((w) => (
                  <li key={w.start} className="list-row"><span className="lr-main">
                    <span>{weekRange(w)}</span>
                    <span className="lr-sub">Zużycie: {qty(w.used_g, w.used_ml)} ({dni(w.use_days)} z użyciem)</span>
                    {(w.bought_g > 0 || w.bought_ml > 0) && <span className="lr-sub">Wykup: {qty(w.bought_g, w.bought_ml)}</span>}
                    <span className="lr-sub">Objawy: {symLine(w)}</span>
                  </span></li>
                ))}
              </ul>
              <div className="table-wrap report-wide"><table className="cmp report-weeks">
                <thead>
                  <tr><th rowSpan={2}>Tydzień</th><th colSpan={units.length + 1}>Zużycie</th><th colSpan={units.length}>Wykup</th><th colSpan={5}>Objawy (średnie 0–10)</th></tr>
                  <tr>{units.map((u) => <th key={u} className="num">{u}</th>)}<th className="num">dni</th>{units.map((u) => <th key={u} className="num">{u}</th>)}
                    <th className="num">dni z wpisem</th>{SYMPTOMS.map((s) => <th key={s.key} className="num">{s.short}</th>)}</tr>
                </thead>
                <tbody>{weekly.map((w) => (
                  <tr key={w.start}><td>{weekRange(w)}</td>
                    {units.map((u) => <td key={u} className="num">{nf(u === 'g' ? w.used_g : w.used_ml, 2)}</td>)}<td className="num">{w.use_days}</td>
                    {units.map((u) => <td key={u} className="num">{nf(u === 'g' ? w.bought_g : w.bought_ml, 2)}</td>)}
                    <td className="num">{w.sym_days}</td>{SYMPTOMS.map((s) => <td key={s.key} className="num">{av(w[s.key])}</td>)}</tr>
                ))}</tbody>
              </table></div>
            </>
          )}
          <p className="muted small">Tygodnie od poniedziałku, pierwszy i ostatni mogą być niepełne. Ból i lęk: wyższa wartość oznacza gorzej. Sen i nastrój: wyższa wartość oznacza lepiej.
            {sym.days > 0 && ` Cały okres (${dniGen(sym.days)} z wpisem): ${SYMPTOMS.map((s) => `${s.short} ${av(sym[s.key])}`).join(', ')}.`}</p>

          <h3>Recepty w okresie</h3>
          {rx.length === 0 ? <p className="muted">Brak zapisanych recept ważnych w tym okresie.</p> : (
            <>
              <dl className="facts">
                <div><dt>Wystawione w okresie</dt><dd>{rxSum.issued}</dd></div>
                <div><dt>Ważne na {day(to)}</dt><dd>{rxSum.valid}</dd></div>
                <div><dt>Przepisano</dt><dd>{rxQty(rxSum.prescribed)}</dd></div>
                <div><dt>Wykupiono w ramach recept</dt><dd>{rxQty(rxSum.bought)}</dd></div>
                <div><dt>Niewykorzystane (wygasłe)</dt><dd>{rxQty(rxSum.unused)}</dd></div>
                <div><dt>Do wykupienia (ważne)</dt><dd>{rxQty(rxSum.left)}</dd></div>
              </dl>
              <ul className="list report-narrow">
                {rx.map((r) => (
                  <li key={r.id} className="list-row"><span className="lr-main"><span>{day(r.issued_on)}</span>
                    <span className="lr-sub">{r.valid_until ? `Ważna do ${day(r.valid_until)}` : 'Bez terminu ważności'} · wykupiono {nf(r.bought, 2)} {r.unit}</span>
                    <span className="lr-sub">{rxState(r)}</span></span>
                  <span className="lr-value">{nf(r.grams, 2)} {r.unit}</span></li>
                ))}
              </ul>
              <div className="table-wrap report-wide"><table className="cmp"><thead><tr><th>Wystawiona</th><th>Ważna do</th><th className="num">Przepisano</th><th className="num">Wykupiono</th><th>Stan na {short(to)}</th></tr></thead>
                <tbody>{rx.map((r) => (<tr key={r.id}><td>{day(r.issued_on)}</td><td>{r.valid_until ? day(r.valid_until) : 'bez terminu'}</td>
                  <td className="num">{nf(r.grams, 2)} {r.unit}</td><td className="num">{nf(r.bought, 2)} {r.unit}</td><td>{rxState(r)}</td></tr>))}</tbody></table></div>
            </>
          )}
          <p className="muted small">Wykup liczony z zakupów zapisanych przez pacjenta w okresie ważności recepty, do {day(to)}; susz w gramach, olej i pen w ml osobno.</p>

          <h3>Zużycie według odmian</h3>
          {usage.length === 0 ? <p className="muted">Brak zapisanego zużycia w tym okresie.</p> : (
            <>
              <ul className="list report-narrow">
                {usage.map((u, i) => (
                  <li key={i} className="list-row"><span className="lr-main"><span className="dn">{u.name}</span><span className="lr-sub">{meta(u)}</span></span><span className="lr-value">{nf(u.grams, 2)} {u.unit}</span></li>
                ))}
              </ul>
              <div className="table-wrap report-wide"><table className="cmp"><thead><tr><th>Odmiana</th><th>Producent</th><th>THC</th><th>CBD</th><th className="num">Dni użycia</th><th className="num">Razem</th></tr></thead>
                <tbody>{usage.map((u, i) => (<tr key={i}><td><span className="dn">{u.name}</span></td><td><span className="dn">{u.producer}</span></td><td>{u.thc != null ? `${nf(u.thc)}%` : '–'}</td><td>{u.cbd != null ? `${nf(u.cbd)}%` : '–'}</td><td className="num">{u.days}</td><td className="num">{nf(u.grams, 2)} {u.unit}</td></tr>))}</tbody></table></div>
            </>
          )}

          {strainSym.length > 0 && sym.days > 0 && (<><h3>Objawy w dniach z odmianą</h3>
            <ul className="list report-narrow">
              {strainSym.map((s, i) => (
                <li key={i} className="list-row"><span className="lr-main"><span className="dn">{s.name}</span>
                  <span className="lr-sub">{dni(s.days)} użycia{s.mixed > 0 && `, w tym ${s.mixed} z inną odmianą`}</span>
                  <span className="lr-sub">{SYMPTOMS.map((x) => `${x.short}: ${symCell(s, x.key)}`).join(' · ')}</span></span></li>
              ))}
            </ul>
            <div className="table-wrap report-wide"><table className="cmp"><thead><tr><th>Odmiana</th><th className="num">Dni użycia</th>{SYMPTOMS.map((x) => <th key={x.key}>{x.label}</th>)}</tr></thead>
              <tbody>{strainSym.map((s, i) => (<tr key={i}><td><span className="dn">{s.name}</span></td><td className="num">{s.days}{s.mixed > 0 && ` (${s.mixed} miesz.)`}</td>
                {SYMPTOMS.map((x) => <td key={x.key}>{symCell(s, x.key)}</td>)}</tr>))}</tbody></table></div>
            <p className="muted small">Średnie objawów z dni, w których zapisano użycie odmiany; w nawiasie liczba dni z wpisem. Ból, lęk i nastrój z tego samego dnia, jakość snu z dnia następnego (wpis dotyczy minionej nocy). Dzień z kilkoma odmianami liczy się przy każdej z nich (dni mieszane, w tabeli „miesz.”). Średnią podajemy przy co najmniej {MIN_SYMPTOM_DAYS} dniach z wpisem. To zestawienie zapisów pacjenta, nie porównanie skuteczności odmian.</p></>)}

          {purchases.length > 0 && (<><h3>Zakupy</h3>
            <ul className="list report-narrow">
              {purchases.map((p, i) => (
                <li key={i} className="list-row"><span className="lr-main"><span className="dn">{p.name}</span><span className="lr-sub">{day(p.at)}</span></span><span className="lr-value">{nf(p.grams, 2)} {p.unit}{p.cost != null && <small>{nf(p.cost, 2)} zł</small>}</span></li>
              ))}
            </ul>
            <div className="table-wrap report-wide"><table className="cmp"><thead><tr><th>Data</th><th>Odmiana</th><th className="num">Ilość</th><th className="num">Koszt</th></tr></thead>
              <tbody>{purchases.map((p, i) => <tr key={i}><td>{day(p.at)}</td><td><span className="dn">{p.name}</span></td><td className="num">{nf(p.grams, 2)} {p.unit}</td><td className="num">{p.cost != null ? `${nf(p.cost, 2)} zł` : '–'}</td></tr>)}</tbody></table></div>
            <p className="muted small">Razem: {both(bought)}.</p></>)}

          {feel.length > 0 && (<><h3>Odczucia pacjenta (skala 0–10)</h3>
            <ul className="list report-narrow">
              {feel.map((f, i) => (
                <li key={i} className="list-row"><span className="lr-main"><span className="dn">{f.name}</span><span className="lr-sub">{feelLine(f) || 'Brak ocen odczuć'}</span>{withNotes && f.notes && <span className="lr-sub">{f.notes}</span>}</span><span className="lr-value">{f.rating != null ? nf(f.rating) : '–'}</span></li>
              ))}
            </ul>
            <div className="table-wrap report-wide"><table className="cmp"><thead><tr><th>Odmiana</th><th>Ocena</th>{EFFECTS.map(([, l]) => <th key={l}>{l}</th>)}{withNotes && <th>Spostrzeżenia</th>}</tr></thead>
              <tbody>{feel.map((f, i) => (<tr key={i}><td><span className="dn">{f.name}</span></td><td>{f.rating != null ? nf(f.rating) : '–'}</td>{EFFECTS.map(([k]) => <td key={k}>{fx(f.effects, k) != null ? nf(fx(f.effects, k)) : '–'}</td>)}{withNotes && <td>{f.notes || '–'}</td>}</tr>))}</tbody></table></div>
            <p className="muted small">Ogólne oceny odmian wpisane przez pacjenta, niezwiązane z okresem raportu.</p></>)}
        </section>
        <p className="muted small no-print"><Link href="/historia">Historia zakupów i zużycia</Link> · <Link href="/recepty">Recepty</Link> · <Link href="/dziennik">Dziennik objawów</Link></p>
      </main>
    </>
  );
}
