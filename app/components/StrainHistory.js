'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const LABELS = {
  producer: 'Producent', name: 'Nazwa', type: 'Typ', final_rating: 'Ocena końcowa', taste: 'Smak', thc: 'THC (%)', cbd: 'CBD (%)',
  kind: 'Rodzaj', terpenes: 'Terpeny', description: 'Opis', price_per_g: 'Cena za gram (zł)', batch: 'Partia',
  expires_on: 'Ważne do', form: 'Postać', sources: 'Źródła', description_auto: 'Opis automatyczny',
};

function show(field, v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '(brak)';
  if (field === 'terpenes') return v.join(', ');
  if (field === 'sources') return v.map((x) => x.title || x.url).join(', ');
  if (field === 'description_auto') return v ? 'tak' : 'nie';
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

// Historia zmian pól wspólnych odmiany (wczytywana dopiero po rozwinięciu)
export default function StrainHistory({ strainId, isAdmin, hidePrice = false }) {
  const router = useRouter();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(0);

  async function load() {
    setError('');
    try {
      const r = await fetch(`/api/strains/${strainId}/history`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Nie udało się wczytać historii.');
      setItems(d.history);
    } catch (e) { setError(e.message); }
  }

  async function restore(editId) {
    if (!confirm('Przywrócić poprzednie wartości z tego wpisu?')) return;
    setBusy(editId);
    setError('');
    try {
      const r = await fetch(`/api/strains/${strainId}/history`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ editId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Nie udało się przywrócić.');
      await load();
      router.refresh();
    } catch (e) { setError(e.message); }
    setBusy(0);
  }

  return (
    <details className="card" onToggle={(e) => { if (e.currentTarget.open && items === null) load(); }}>
      <summary><b>Historia zmian</b></summary>
      {error && <p className="alert error">{error}</p>}
      {items === null && !error && <p className="muted">Wczytuję…</p>}
      {items?.length === 0 && <p className="muted">Nikt jeszcze nie zmieniał danych tej odmiany.</p>}
      {items?.map((h) => (
        <div key={h.id} className="history-item">
          <p className="muted"><b>{h.mine ? 'Ty' : h.who}</b>, {h.at}</p>
          <ul>
            {Object.entries(h.changes).filter(([f]) => !(hidePrice && f === 'price_per_g')).map(([f, [a, b]]) => (
              <li key={f}>{LABELS[f] || f}: {show(f, a)} → {show(f, b)}</li>
            ))}
          </ul>
          {isAdmin && <button className="btn ghost small" disabled={busy === h.id} onClick={() => restore(h.id)}>Przywróć</button>}
        </div>
      ))}
    </details>
  );
}
