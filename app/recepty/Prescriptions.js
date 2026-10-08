'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import useNativeRefresh from '@/app/components/native/useNativeRefresh';
import Icon from '@/app/components/Icon';
import { formatDay } from '@/lib/date';
import RxForm from './RxForm';

const daysLeft = (iso) => Math.ceil((new Date(`${iso}T23:59:59`) - Date.now()) / 864e5);
const nf = (n) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 2 });
const fmt = formatDay;
const dni = (n) => (n === 1 ? '1 dzień' : `${n} dni`);
const uOf = (p) => (p.unit === 'ml' ? 'ml' : 'g'); // recepta na susz (g) albo olej / pen (ml)

export default function Prescriptions() {
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => { api('/api/prescriptions').then((r) => setList(r.prescriptions)).catch((e) => setMsg(e.message)); }, []);
  useNativeRefresh(() => api('/api/prescriptions').then((r) => setList(r.prescriptions)));
  // „Wykupiłem” w karcie „W aptece” zmienia wykup w okresie ważności recept
  useEffect(() => {
    const on = () => api('/api/prescriptions').then((r) => setList(r.prescriptions)).catch(() => {});
    window.addEventListener('zielnik:purchase', on);
    return () => window.removeEventListener('zielnik:purchase', on);
  }, []);

  async function remove(id) {
    if (confirm('Usunąć tę receptę z listy?')) setList((await api('/api/prescriptions', 'DELETE', { id })).prescriptions);
  }
  const showForm = open || list?.length === 0;

  return (
    <div className="stack">
      <div className="alert note">Notatnik recept służy tylko do Twojej orientacji: ilość wykupioną liczymy z Twoich zapisanych zakupów w okresie ważności recepty (susz w gramach, olej i pen w ml osobno). To nie jest dokument ani rejestr medyczny. Dane są prywatne.</div>

      {msg && !showForm && <div className="alert error" role="alert">{msg}</div>}
      {list === null ? <p className="muted" aria-busy="true">Ładuję…</p> : list.length === 0 ? (
        <div className="card empty">
          <Icon name="clipboard" size={32} />
          <h2>Brak recept</h2>
          <p>Dodaj pierwszą receptę, a tu zobaczysz, ile zostało do wykupienia.</p>
          <button type="button" className="btn" onClick={() => { const el = document.getElementById('rx-from'); el?.scrollIntoView({ block: 'center' }); el?.focus({ preventScroll: true }); }}>Dodaj receptę</button>
        </div>
      ) : (
        <>
          <h2 className="section-label">Twoje recepty</h2>
          <ul className="list">
            {list.map((p) => {
              const left = Math.max(p.grams - p.bought, 0);
              const u = uOf(p);
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
                    <h3 className="rx-title">{nf(p.grams)} {u}{p.note && <small>{p.note}</small>}</h3>
                    {state}
                  </div>
                  <progress value={Math.min(p.bought, p.grams)} max={p.grams} aria-label="Wykupiono z przepisanej ilości" />
                  <p className="rx-amount">Wykupiono <b>{nf(p.bought)} {u}</b>, zostało <b>{nf(left)} {u}</b>{expired && !done && ' (niewykorzystane)'}</p>
                  {p.estimated > 0 && <p className="muted rx-est">{nf(p.estimated)} {u} liczone z szacunku (zakupy bez przypisania) — przypisz je w Historii.</p>}
                  <p className="rx-dates">Wystawiona {fmt(p.issued_on)}{p.valid_until ? `, ważna do ${fmt(p.valid_until)}` : ''}</p>
                  <div className="rx-foot"><button type="button" className="btn text small" onClick={() => remove(p.id)} aria-label={`Usuń receptę ${nf(p.grams)} ${u}`}>Usuń</button></div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <details className="card rx-add" open={showForm} onToggle={(e) => { if (list?.length) setOpen(e.currentTarget.open); }}>
        <summary><Icon name="plus" size={20} />Nowa recepta</summary>
        <RxForm onAdded={(l) => { setList(l); setMsg(''); setOpen(false); }} />
      </details>
    </div>
  );
}
