'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import useNativeRefresh from '@/app/components/native/useNativeRefresh';
import Icon from '@/app/components/Icon';
import { parseNum, decimalProps } from '@/app/components/num';

const today = () => new Date().toISOString().slice(0, 10);
const daysLeft = (iso) => Math.ceil((new Date(`${iso}T23:59:59`) - Date.now()) / 864e5);
const nf = (n) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 2 });
const fmt = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
const dni = (n) => (n === 1 ? '1 dzień' : `${n} dni`);

export default function Prescriptions() {
  const [list, setList] = useState(null);
  const [f, setF] = useState({ issuedOn: today(), validUntil: '', grams: '', note: '' });
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => { api('/api/prescriptions').then((r) => setList(r.prescriptions)).catch((e) => setMsg(e.message)); }, []);
  useNativeRefresh(() => api('/api/prescriptions').then((r) => setList(r.prescriptions)));

  async function add(e) {
    e.preventDefault();
    const grams = parseNum(f.grams);
    if (!(grams > 0)) { setMsg('Podaj przepisaną ilość w gramach, np. 10 lub 7,5.'); return; }
    try { setList((await api('/api/prescriptions', 'POST', { ...f, grams })).prescriptions); setF({ ...f, grams: '', note: '' }); setMsg(''); setOpen(false); }
    catch (err) { setMsg(err.message); }
  }
  async function remove(id) {
    if (confirm('Usunąć tę receptę z listy?')) setList((await api('/api/prescriptions', 'DELETE', { id })).prescriptions);
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const showForm = open || list?.length === 0;

  return (
    <div className="stack">
      <div className="alert note">Notatnik recept służy tylko do Twojej orientacji: ilość wykupioną liczymy z Twoich zapisanych zakupów w okresie ważności recepty. To nie jest dokument ani rejestr medyczny. Dane są prywatne.</div>

      {msg && !showForm && <div className="alert error" role="alert">{msg}</div>}
      {list === null ? <p className="muted" aria-busy="true">Ładuję…</p> : list.length === 0 ? (
        <div className="card empty">
          <Icon name="clipboard" size={32} />
          <h2>Brak recept</h2>
          <p>Dodaj pierwszą receptę, a tu zobaczysz, ile zostało do wykupienia.</p>
        </div>
      ) : (
        <>
          <h2 className="section-label">Twoje recepty</h2>
          <ul className="list">
            {list.map((p) => {
              const left = Math.max(p.grams - p.bought, 0);
              const d = p.valid_until ? daysLeft(p.valid_until) : null;
              const expired = d != null && d < 0;
              const done = left === 0;
              let state = null;
              if (done) state = <span className="rx-state">Wykorzystana</span>;
              else if (expired) state = <span className="badge low">Wygasła</span>;
              else if (d != null && d <= 7) state = <span className="badge low">Kończy się za {dni(d)}</span>;
              else if (d != null) state = <span className="rx-state">Ważna jeszcze {dni(d)}</span>;
              else state = <span className="rx-state">Bez daty ważności</span>;
              return (
                <li key={p.id} className={`rx-row${done ? ' done' : ''}${expired ? ' expired' : ''}`}>
                  <div className="rx-top">
                    <h3 className="rx-title">{nf(p.grams)} g{p.note && <small>{p.note}</small>}</h3>
                    {state}
                  </div>
                  <progress value={Math.min(p.bought, p.grams)} max={p.grams} aria-label="Wykupiono z przepisanej ilości" />
                  <p className="rx-amount">Wykupiono <b>{nf(p.bought)} g</b>, zostało <b>{nf(left)} g</b>{expired && !done && ' (niewykorzystane)'}</p>
                  <p className="rx-dates">Wystawiona {fmt(p.issued_on)}{p.valid_until ? `, ważna do ${fmt(p.valid_until)}` : ''}</p>
                  <div className="rx-foot"><button type="button" className="btn text small" onClick={() => remove(p.id)} aria-label={`Usuń receptę ${nf(p.grams)} g`}>Usuń</button></div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <details className="card rx-add" open={showForm} onToggle={(e) => { if (list?.length) setOpen(e.currentTarget.open); }}>
        <summary><Icon name="plus" size={20} />Nowa recepta</summary>
        <form className="stack" onSubmit={add}>
          <div className="row">
            <div className="field grow"><label htmlFor="rx-from">Data wystawienia</label><input id="rx-from" className="input" type="date" required value={f.issuedOn} onChange={set('issuedOn')} /></div>
            <div className="field grow"><label htmlFor="rx-to">Ważna do (opcjonalnie)</label><input id="rx-to" className="input" type="date" value={f.validUntil} onChange={set('validUntil')} /></div>
            <div className="field grow"><label htmlFor="rx-g">Przepisana ilość (g)</label><input id="rx-g" className="input" {...decimalProps} required value={f.grams} onChange={set('grams')} /></div>
          </div>
          <div className="field"><label htmlFor="rx-n">Notatka (np. lekarz, numer)</label><input id="rx-n" className="input" maxLength={120} value={f.note} onChange={set('note')} /></div>
          {msg && <div className="alert error" role="alert">{msg}</div>}
          <div><button className="btn">Dodaj receptę</button></div>
        </form>
      </details>
    </div>
  );
}
