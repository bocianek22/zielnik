'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { orderedChanges, showValue, STATUS_LABELS } from '@/lib/proposal-fields';

// Moje propozycje zmian tej odmiany (KAT-1): oczekująca z możliwością wycofania i ostatnia rozpatrzona
export default function StrainProposals({ proposals, onChange }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = proposals.find((p) => p.status === 'oczekuje');
  const decided = pending ? null : proposals.find((p) => p.status !== 'oczekuje');
  const shown = pending || decided;
  if (!shown) return null;

  async function withdraw() {
    if (!confirm('Wycofać propozycję zmiany?')) return;
    setBusy(true); setError('');
    try { await api(`/api/proposals/${shown.id}`, 'DELETE'); onChange(); } catch (e) { setError(e.message); setBusy(false); }
  }

  const title = pending ? 'Twoja propozycja czeka'
    : shown.status === 'przyjeta' ? 'Twoja propozycja została przyjęta' : 'Twoja propozycja została odrzucona';
  return (
    <section className={`card proposal-box ${shown.status}`} aria-labelledby="myprop-h">
      <h2 id="myprop-h">{title}</h2>
      <p className="muted small">
        {pending ? `Wysłana ${shown.at}. Admin ją sprawdzi; do tego czasu odmiana zostaje bez zmian.` : `Rozpatrzona ${shown.decidedAt} (${STATUS_LABELS[shown.status]}).`}
      </p>
      {shown.status === 'odrzucona' && shown.rejectReason && <p className="proposal-reason">Powód: {shown.rejectReason}</p>}
      <ul className="proposal-diff">
        {orderedChanges(shown.changes).map((c) => (
          <li key={c.field}>
            <span className="proposal-field">{c.label}</span>
            <span className="proposal-vals"><s>{showValue(c.field, c.before)}</s> <b>{showValue(c.field, c.after)}</b></span>
          </li>
        ))}
      </ul>
      {error && <div className="alert error" role="alert">{error}</div>}
      {pending && <button type="button" className="btn ghost small" disabled={busy} onClick={withdraw}>{busy ? 'Wycofuję…' : 'Wycofaj propozycję'}</button>}
    </section>
  );
}
