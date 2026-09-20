'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const today = () => new Date().toISOString().slice(0, 10);
const daysLeft = (iso) => Math.ceil((new Date(`${iso}T23:59:59`) - Date.now()) / 864e5);

export default function Prescriptions() {
  const [list, setList] = useState(null);
  const [f, setF] = useState({ issuedOn: today(), validUntil: '', grams: '', note: '' });
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/api/prescriptions').then((r) => setList(r.prescriptions)).catch((e) => setMsg(e.message)); }, []);

  async function add(e) {
    e.preventDefault();
    try { setList((await api('/api/prescriptions', 'POST', f)).prescriptions); setF({ ...f, grams: '', note: '' }); setMsg(''); }
    catch (err) { setMsg(err.message); }
  }
  async function remove(id) {
    if (confirm('Usunąć tę receptę z listy?')) setList((await api('/api/prescriptions', 'DELETE', { id })).prescriptions);
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="stack">
      <div className="alert note">Notatnik recept służy tylko do Twojej orientacji: ilość wykupioną liczymy z Twoich zapisanych zakupów w okresie ważności recepty. To nie jest dokument ani rejestr medyczny. Dane są prywatne.</div>
      <form className="card stack" onSubmit={add}>
        <h2>Nowa recepta</h2>
        <div className="row">
          <div className="field grow"><label htmlFor="rx-from">Data wystawienia</label><input id="rx-from" className="input" type="date" required value={f.issuedOn} onChange={set('issuedOn')} /></div>
          <div className="field grow"><label htmlFor="rx-to">Ważna do (opcjonalnie)</label><input id="rx-to" className="input" type="date" value={f.validUntil} onChange={set('validUntil')} /></div>
          <div className="field grow"><label htmlFor="rx-g">Przepisana ilość (g)</label><input id="rx-g" className="input" type="number" min="0.1" step="0.1" required value={f.grams} onChange={set('grams')} /></div>
        </div>
        <div className="field"><label htmlFor="rx-n">Notatka (np. lekarz, numer)</label><input id="rx-n" className="input" maxLength={120} value={f.note} onChange={set('note')} /></div>
        {msg && <div className="alert error" role="alert">{msg}</div>}
        <div><button className="btn">Dodaj receptę</button></div>
      </form>

      {list === null ? <p className="muted">Ładuję…</p> : list.length === 0 ? <p className="muted">Nie dodano jeszcze żadnej recepty.</p> : list.map((p) => {
        const left = Math.max(p.grams - p.bought, 0);
        const d = p.valid_until ? daysLeft(p.valid_until) : null;
        const expired = d != null && d < 0;
        return (
          <article key={p.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>{p.grams} g {p.note && <span className="muted">{p.note}</span>}</h3>
              <span>
                {expired && left > 0 && <span className="badge low">Wygasła, niewykorzystane {Number(left.toFixed(2))} g</span>}
                {expired && left === 0 && <span className="badge">Wykorzystana</span>}
                {!expired && d != null && d <= 7 && left > 0 && <span className="badge low">Wygasa za {d} dni</span>}
              </span>
            </div>
            <progress value={Math.min(p.bought, p.grams)} max={p.grams} style={{ width: '100%' }} aria-label="Wykupiono z przepisanej ilości" />
            <p>Wykupiono <b>{Number(p.bought.toFixed(2))} g</b> z {p.grams} g, zostało <b>{Number(left.toFixed(2))} g</b>.</p>
            <p className="muted small">Wystawiona {p.issued_on}{p.valid_until ? `, ważna do ${p.valid_until}${!expired ? ` (jeszcze ${d} dni)` : ''}` : ''}.</p>
            <button className="btn ghost small" onClick={() => remove(p.id)}>Usuń</button>
          </article>
        );
      })}
    </div>
  );
}
