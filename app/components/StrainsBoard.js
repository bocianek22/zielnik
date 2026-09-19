'use client';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import StrainCard from './StrainCard';
import StrainForm from './StrainForm';

export default function StrainsBoard({ initialStrains, initialOptions, me }) {
  const [strains, setStrains] = useState(initialStrains);
  const [options, setOptions] = useState(initialOptions);
  const [query, setQuery] = useState('');
  const [onlyStock, setOnlyStock] = useState(false);
  const [formFor, setFormFor] = useState(null); // null | 'new' | id odmiany
  const [error, setError] = useState('');

  async function refresh() {
    const r = await api('/api/strains');
    setStrains(r.strains);
    setOptions(r.options);
    setFormFor(null);
  }

  function entrySaved(strainId, entry) {
    setStrains((list) => list.map((s) => (s.id !== strainId ? s : {
      ...s, entries: s.entries.map((e) => (e.userId === me.id ? { ...e, ...entry } : e)),
    })));
  }

  const tastes = useMemo(() => [...new Set(strains.map((s) => s.taste).filter(Boolean))], [strains]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return strains.filter((s) => {
      if (onlyStock && !(s.entries.find((e) => e.userId === me.id)?.current > 0)) return false;
      return !q || `${s.name} ${s.producer} ${s.type} ${s.taste}`.toLowerCase().includes(q);
    });
  }, [strains, query, onlyStock, me.id]);

  const canDelete = (s) => me.isAdmin || s.created_by === me.id;

  return (
    <div className="stack">
      <div className="toolbar">
        <input className="input search" type="search" placeholder="Szukaj: odmiana, producent, smak…" aria-label="Szukaj"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className="check">
          <input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} />
          Tylko te, które mam
        </label>
        <button className="btn" onClick={() => setFormFor('new')}>Dodaj odmianę</button>
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}

      {formFor === 'new' && (
        <StrainForm options={options} tastes={tastes} onOptionsChange={setOptions}
          onDone={() => refresh().catch((e) => setError(e.message))} onCancel={() => setFormFor(null)} />
      )}

      {strains.length === 0 && formFor !== 'new' && (
        <div className="card empty">
          <h2>Zielnik jest jeszcze pusty</h2>
          <p className="muted">Dodaj pierwszą odmianę. Każdy użytkownik dostanie dla niej własne pola: ocenę, ilość, ilość do wykupienia i spostrzeżenia.</p>
        </div>
      )}
      {strains.length > 0 && visible.length === 0 && <p className="muted">Nic nie pasuje do filtrów.</p>}

      {visible.map((s) => (formFor === s.id ? (
        <StrainForm key={s.id} strain={s} options={options} tastes={tastes} canDelete={canDelete(s)}
          onOptionsChange={setOptions} onDone={() => refresh().catch((e) => setError(e.message))}
          onCancel={() => setFormFor(null)} />
      ) : (
        <StrainCard key={s.id} strain={s} meId={me.id} onEdit={() => setFormFor(s.id)} onEntrySaved={entrySaved} />
      )))}
    </div>
  );
}
