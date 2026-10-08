'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { collectMeta, referrerPath } from '@/lib/feedback-client';
import { KINDS, BODY_MAX } from '@/lib/feedback-consts';
import Icon from '../components/Icon';

const STATUS = { nowe: 'Nowe', w_toku: 'W toku', zrobione: 'Zrobione' };
const KIND_HINT = { 'błąd': 'Coś nie działa', 'pomysł': 'Co by pomogło', inne: 'Inne' };

// Formularz „Zgłoś uwagę” i lista własnych zgłoszeń ze statusem. Teksty bez nazwy aplikacji (tryb dyskretny).
export default function FeedbackForm({ initial, screen, groupUrl }) {
  const [kind, setKind] = useState('błąd');
  const [body, setBody] = useState('');
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function send(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await api('/api/feedback', 'POST', { kind, body, meta: collectMeta(screen || referrerPath()) });
      setItems(r.items); setBody('');
      setMsg(`Dziękujemy. Zgłoszenie nr ${r.id} trafiło do administratora.`);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  return (
    <div className="stack">
      <form className="card" onSubmit={send}>
        <p className="muted">Napisz, co nie działa albo co by pomogło. Nie wpisuj danych zdrowotnych ani osobowych i nie dołączaj zrzutów ekranu.</p>
        <div className="field" role="radiogroup" aria-labelledby="fb-kind">
          <span id="fb-kind" className="label">Rodzaj uwagi</span>
          <div className="chips">
            {KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={`chip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>
                {KIND_HINT[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="fb-body">Opis</label>
          <textarea id="fb-body" className="input" rows={6} maxLength={BODY_MAX} value={body} onChange={(e) => setBody(e.target.value)} required aria-describedby="fb-help" />
          <small id="fb-help" className="muted">{body.length}/{BODY_MAX}. Dołączymy automatycznie: wersję, nazwę ekranu (bez numerów), rodzaj urządzenia i motyw.</small>
        </div>
        {err && <div className="alert error" role="alert">{err}</div>}
        {msg && <div className="alert ok" role="status">{msg}</div>}
        <button className="btn block" disabled={busy || !body.trim()}>{busy ? 'Wysyłam…' : 'Wyślij'}</button>
        {groupUrl && (
          <p className="muted"><a href={groupUrl} target="_blank" rel="noopener noreferrer">Dołącz do grupy testerów<Icon name="share" size={16} /></a> i porozmawiaj z innymi.</p>
        )}
      </form>

      <section aria-labelledby="fb-mine">
        <h2 id="fb-mine" className="section-label">Twoje zgłoszenia</h2>
        {items.length === 0 ? <p className="muted">Nic jeszcze nie wysłano.</p> : (
          <ul className="list">
            {items.map((i) => (
              <li key={i.id} className="list-row fb-row">
                <span className="lr-main">
                  <span className="fb-body">{i.body}</span>
                  <span className="lr-sub">#{i.id}, {KIND_HINT[i.kind]}, {i.at}</span>
                </span>
                <span className={`badge fb-${i.status}`}>{STATUS[i.status]}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted"><Link href="/pomoc">Pomoc i instalacja</Link></p>
      </section>
    </div>
  );
}
