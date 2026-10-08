'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { STATUSES } from '@/lib/feedback-consts';
import Icon from '../components/Icon';

const STATUS = { nowe: 'Nowe', w_toku: 'W toku', zrobione: 'Zrobione' };
const PLATFORM = { apk: 'aplikacja', pwa: 'PWA', 'przeglądarka': 'przeglądarka' };

function metaLine(m) {
  return [m.version && `v${m.version}`, m.path, PLATFORM[m.platform], m.theme, m.discreet && 'dyskretny', m.viewport].filter(Boolean).join(' · ');
}

// Uwagi testerów (BETA-A): lista, status i notatka (notatki autor nie widzi)
export default function FeedbackAdmin({ onCount }) {
  const [items, setItems] = useState(null);
  const [msg, setMsg] = useState('');
  const [notes, setNotes] = useState({});
  useEffect(() => { if (items) onCount?.(items.filter((i) => i.status === 'nowe').length); }, [items, onCount]);
  useEffect(() => { api('/api/admin/feedback').then((r) => setItems(r.items)).catch((e) => setMsg(e.message)); }, []);
  async function save(id, patch) {
    setMsg('');
    try { setItems((await api('/api/admin/feedback', 'POST', { id, ...patch })).items); } catch (e) { setMsg(e.message); }
  }
  return (
    <section className="admin-sec" aria-labelledby="fbadm-h">
      <h2 id="fbadm-h" className="section-label">Uwagi testerów{items?.length ? ` (${items.length})` : ''}</h2>
      {msg && <div className="alert error" role="alert">{msg}</div>}
      {items === null ? <p className="muted">Ładuję…</p> : items.length === 0 ? (
        <div className="empty">
          <Icon name="edit" size={32} />
          <h2>Brak uwag</h2>
          <p>Zgłoszenia z formularza „Zgłoś uwagę” pojawią się tutaj.</p>
        </div>
      ) : (
        <ul className="list">{items.map((i) => (
          <li key={i.id} className="admin-report">
            <p className="admin-report-title">#{i.id}, {i.kind} <span className={`badge fb-${i.status}`}>{STATUS[i.status]}</span></p>
            <p className="muted small">{i.username}, {i.at}</p>
            <p className="admin-quote">{i.body}</p>
            <p className="muted small">{metaLine(i.meta || {})}</p>
            <div className="field">
              <label htmlFor={`fb-st-${i.id}`}>Status</label>
              <select id={`fb-st-${i.id}`} className="input" value={i.status} onChange={(e) => save(i.id, { status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`fb-nt-${i.id}`}>Notatka (tylko dla administratora)</label>
              <input id={`fb-nt-${i.id}`} className="input" maxLength={1000} value={notes[i.id] ?? i.note} onChange={(e) => setNotes({ ...notes, [i.id]: e.target.value })} />
            </div>
            <div className="admin-actions-bar">
              <button type="button" className="btn small" disabled={(notes[i.id] ?? i.note) === i.note} onClick={() => save(i.id, { note: notes[i.id] })}>Zapisz notatkę</button>
            </div>
          </li>))}</ul>)}
    </section>
  );
}
