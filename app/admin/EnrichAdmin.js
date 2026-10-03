'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function EnrichAdmin() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [r, setR] = useState(null);
  async function run() {
    setBusy(true); setMsg(''); setR(null);
    try { setR(await api('/api/admin/enrich', 'POST')); } catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  return (
    <section className="admin-sec">
      <h2 className="section-label">Katalog Zielnika</h2>
      <p className="muted small admin-note">Uzupełnia puste pola odmian (terpeny, smak, opis) danymi z wbudowanego katalogu, dopasowując po producencie i nazwie. Niczego nie nadpisuje, a zmiany zapisuje w historii odmiany jako „Zielnik (katalog)”. Opis z katalogu dostaje oznaczenie poglądowego.</p>
      <div className="admin-actions-bar">
        <button className="btn" onClick={run} disabled={busy}>{busy ? 'Uzupełniam…' : 'Uzupełnij dane z katalogu Zielnika'}</button>
      </div>
      {msg && <div className="alert error" role="alert">{msg}</div>}
      {r && (
        <div className="alert note" role="status">
          <p>Sprawdzono {r.checked} odmian (katalog: {r.catalogSize}). Uzupełniono: {r.updated} (smak: {r.filled.taste}, terpeny: {r.filled.terpenes}, opis: {r.filled.description}). Bez zmian: {r.unchanged}. Bez dopasowania: {r.unmatched}.{r.ambiguous.length > 0 && ` Pominięto jako niejednoznaczne: ${r.ambiguous.join(', ')}.`}</p>
        </div>
      )}
    </section>
  );
}
