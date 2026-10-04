'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import useQueueEvents from './useQueueEvents';
import { startQueue, removeQueued, flushQueue, queueState } from '@/lib/offline-client';
import { itemLabel, pendingText } from '@/lib/offline-queue';
import { isDiscreet } from '@/lib/discreet';

const hhmm = (t) => new Date(t).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

// Licznik zapisów offline w nagłówku (POM-14): uruchamia kolejkę zalogowanego użytkownika, pokazuje, ile czeka
// na wysłanie, i pozwala usunąć pojedynczy zapis. W trybie dyskretnym etykiety bez nazw odmian.
export default function OfflineQueue({ userId }) {
  const [st, setSt] = useState(null);
  const [rejected, setRejected] = useState([]); // [{ item, message }]
  const [open, setOpen] = useState(false);
  const [discreet, setDiscreet] = useState(false);
  const [offline, setOffline] = useState(false);
  const box = useRef(null);
  const pill = useRef(null);

  useEffect(() => {
    let live = true;
    startQueue(userId).then(() => { if (live) setSt(queueState()); });
    return () => { live = false; };
  }, [userId]);
  useEffect(() => {
    const d = () => setDiscreet(isDiscreet());
    const net = () => setOffline(navigator.onLine === false);
    d(); net();
    window.addEventListener('zielnik:discreet', d);
    window.addEventListener('online', net);
    window.addEventListener('offline', net);
    return () => { window.removeEventListener('zielnik:discreet', d); window.removeEventListener('online', net); window.removeEventListener('offline', net); };
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const out = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') { setOpen(false); pill.current?.focus(); } };
    document.addEventListener('click', out);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', out); document.removeEventListener('keydown', esc); };
  }, [open]);

  useQueueEvents((d) => {
    if (d.type === 'change') setSt(d.state);
    if (d.type === 'rejected') setRejected((r) => [...r, { item: d.item, message: d.message }]);
  });

  const n = st?.pending ?? 0;
  if (!n && !rejected.length) return null;
  const why = st?.blocked === 'auth' ? 'auth'
    : offline ? 'Brak sieci. Wyślę automatycznie, gdy wróci.'
      : st?.sending ? 'Wysyłam…'
        : st?.retryAt ? 'Serwer nie odpowiada, ponowię za chwilę.' : '';
  const warn = rejected.length > 0 && !n;
  return (
    <div className="oq" ref={box}>
      <button type="button" ref={pill} className={`oq-pill${warn ? ' warn' : ''}`} aria-expanded={open} aria-controls="oq-panel"
        aria-label={n ? `${pendingText(n)}. Pokaż zapisy` : 'Odrzucone zapisy. Pokaż'} onClick={() => setOpen((o) => !o)}>
        <Icon name={warn ? 'alert' : 'clock'} size={18} />
        <span aria-hidden="true">{n ? <><b>{n}</b> czeka</> : 'Odrzucono'}</span>
      </button>
      <p className="sr-only" role="status">{n ? pendingText(n) : ''}</p>
      {open && (
        <div id="oq-panel" className="oq-panel" role="region" aria-label="Zapisy czekające na wysłanie">
          {n > 0 && (
            <>
              <p className="oq-title">{pendingText(n)}</p>
              {why === 'auth'
                ? <p className="oq-why">Sesja wygasła. <Link href="/login">Zaloguj się</Link>, a zapisy wyślą się same.</p>
                : why && <p className="oq-why">{why}</p>}
              <ul className="oq-list">
                {st.items.map((i) => (
                  <li key={i.id}>
                    <span className="oq-label">{itemLabel(i, discreet)}<small>zapisano o {hhmm(i.createdAt)}</small></span>
                    <button type="button" className="btn small ghost" disabled={i.id === st.sending} onClick={() => removeQueued(i.id)}
                      aria-label={`Usuń z kolejki: ${itemLabel(i, discreet)}`}>{i.id === st.sending ? 'Wysyłam…' : 'Usuń'}</button>
                  </li>
                ))}
              </ul>
              {!offline && <button type="button" className="btn small" disabled={!!st.sending} onClick={() => flushQueue()}>Wyślij teraz</button>}
            </>
          )}
          {rejected.length > 0 && (
            <>
              <p className="oq-title warn">Serwer nie przyjął {rejected.length === 1 ? 'zapisu' : 'zapisów'}</p>
              <ul className="oq-list">
                {rejected.map((r) => (
                  <li key={r.item.id}><span className="oq-label">{itemLabel(r.item, discreet)}<small>{r.message}</small></span></li>
                ))}
              </ul>
              <button type="button" className="btn small ghost" onClick={() => { setRejected([]); if (!n) setOpen(false); }}>Rozumiem</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
