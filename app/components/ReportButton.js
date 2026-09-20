'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

const REASONS = [['spam', 'Spam'], ['ad', 'Reklama lub sprzedaż'], ['abuse', 'Nękanie lub wyzwiska'], ['privacy', 'Naruszenie prywatności'], ['other', 'Inne']];

// Zgłoszenie profilu (type="user") lub testu (type="test")
export default function ReportButton({ type, userId, refId }) {
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
        <button type="button" className="btn ghost small" onClick={() => setOpen(true)}>Zgłoś</button>
      ) : (
        <form className="row" onSubmit={send}>
          <select className="input" aria-label="Powód zgłoszenia" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input className="input" placeholder="Opis (opcjonalnie)" aria-label="Opis" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn small">Wyślij</button>
          <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>Anuluj</button>
        </form>
      )}
    </span>
  );
}
