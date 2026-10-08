'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { FIELD_LABELS, FIELD_ORDER, showValue } from '@/lib/proposal-fields';
import Icon from '../components/Icon';

const byOrder = (a, b) => FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field);

// Kolejka propozycji zmian pól wspólnych odmian (KAT-1): różnice pole po polu, konflikty, przyjęcie albo odrzucenie z powodem
export default function ProposalsAdmin({ onCount }) {
  const [items, setItems] = useState(null);
  const [msg, setMsg] = useState('');
  const [rejecting, setRejecting] = useState(null); // { id, reason }
  const [busy, setBusy] = useState(0);
  useEffect(() => { if (items) onCount?.(items.length); }, [items, onCount]);
  useEffect(() => { api('/api/admin/proposals').then((r) => setItems(r.proposals)).catch((e) => setMsg(e.message)); }, []);

  async function decide(id, body) {
    setBusy(id); setMsg('');
    try {
      const r = await api('/api/admin/proposals', 'POST', { id, ...body });
      setItems(r.proposals); setRejecting(null);
    } catch (e) { setMsg(e.message); }
    setBusy(0);
  }

  return (
    <section className="admin-sec">
      <h2 className="section-label">Propozycje zmian{items?.length ? ` (${items.length})` : ''}</h2>
      <p className="muted small admin-note">Zmiany pól wspólnych odmian zgłoszone przez osoby, które nie są twórcami odmiany. Przyjęcie zapisuje zmianę i dodaje ją do historii odmiany z autorem propozycji.</p>
      {msg && <div className="alert error" role="alert">{msg}</div>}
      {items === null ? <p className="muted">Ładuję…</p> : items.length === 0 ? (
        <div className="empty">
          <Icon name="shield" size={32} />
          <h2>Brak propozycji do rozpatrzenia</h2>
          <p>Gdy ktoś zaproponuje zmianę cudzej odmiany, pojawi się tutaj.</p>
        </div>
      ) : (
        <ul className="list">{items.map((p) => {
          const diff = [...p.diff].sort(byOrder);
          const conflict = diff.some((d) => d.conflict);
          return (
            <li key={p.id} className="admin-report proposal-item">
              <p className="admin-report-title"><Link href={`/strains/${p.strainId}`}>{p.strain}</Link> <span className="muted small">{p.producer}</span></p>
              <p className="muted small">Proponuje: {p.author}, {p.at}</p>
              {conflict && <p className="proposal-conflict" role="alert"><b>Konflikt.</b> Zaznaczone pole zmieniło się od czasu propozycji. Sprawdź bieżącą wartość.</p>}
              <ul className="proposal-diff">
                {diff.map((d) => (
                  <li key={d.field} className={d.conflict ? 'conflict' : ''}>
                    <span className="proposal-field">{FIELD_LABELS[d.field] || d.field}</span>
                    <span className="proposal-vals">
                      <span className="proposal-old"><span className="muted small">było</span> <s>{showValue(d.field, d.before)}</s></span>
                      <span className="proposal-new"><span className="muted small">proponowane</span> <b>{showValue(d.field, d.after)}</b></span>
                      {d.conflict && <span className="proposal-now"><span className="muted small">teraz</span> {showValue(d.field, d.current)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {rejecting?.id === p.id ? (
                <div className="proposal-reject">
                  <label htmlFor={`rej-${p.id}`}>Powód odrzucenia (widzi go autor)</label>
                  <input id={`rej-${p.id}`} className="input" maxLength={200} value={rejecting.reason} autoFocus
                    onChange={(e) => setRejecting({ id: p.id, reason: e.target.value })} />
                  <div className="admin-actions-bar">
                    <button className="btn danger small" disabled={busy === p.id || !rejecting.reason.trim()}
                      onClick={() => decide(p.id, { action: 'reject', reason: rejecting.reason })}>Odrzuć</button>
                    <button className="btn ghost small" onClick={() => setRejecting(null)}>Anuluj</button>
                  </div>
                </div>
              ) : (
                <div className="admin-actions-bar">
                  <button className="btn small" disabled={busy === p.id}
                    onClick={() => (!conflict || confirm('Pole zmieniło się od czasu propozycji. Nadpisać bieżącą wartość proponowaną?')) && decide(p.id, { action: 'accept', force: conflict })}>
                    {conflict ? 'Przyjmij mimo konfliktu' : 'Przyjmij'}
                  </button>
                  <button className="btn ghost small" disabled={busy === p.id} onClick={() => setRejecting({ id: p.id, reason: '' })}>Odrzuć…</button>
                </div>
              )}
            </li>);
        })}</ul>)}
    </section>
  );
}
