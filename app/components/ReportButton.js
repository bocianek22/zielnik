'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

const REASONS = [['spam', 'Spam'], ['ad', 'Reklama lub sprzedaż'], ['abuse', 'Nękanie lub wyzwiska'], ['privacy', 'Naruszenie prywatności'], ['other', 'Inne']];

// Zgłoszenie profilu (type="user"), testu ("test"), odmiany ("strain") lub jej wspólnego zdjęcia ("photo"; refId = id odmiany)
export default function ReportButton({ type, userId, refId, label = 'Zgłoś' }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');

  async function send(e) {
    e.preventDefault();
    try { await api('/api/reports', 'POST', { type, userId, ref: refId, reason, note }); setMsg('Dziękujemy, zgłoszenie trafiło do administratora.'); setOpen(false); }
    catch (err) { setMsg(err.message); }
  }
  return (
    <span className="report">
      {msg ? <small className="muted" role="status">{msg}</small> : !open ? (
        <button type="button" className="btn text" onClick={() => setOpen(true)}>{label}</button>
      ) : (
        <form className="report-form" onSubmit={send}>
          <div className="field"><label htmlFor={`rr-${type}-${refId || userId}`}>Powód zgłoszenia</label>
            <select id={`rr-${type}-${refId || userId}`} className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div className="field"><label htmlFor={`rn-${type}-${refId || userId}`}>Opis (opcjonalnie)</label>
            <input id={`rn-${type}-${refId || userId}`} className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="row">
            <button className="btn small">Wyślij zgłoszenie</button>
            <button type="button" className="btn text small" onClick={() => setOpen(false)}>Anuluj</button>
          </div>
        </form>
      )}
    </span>
  );
}
