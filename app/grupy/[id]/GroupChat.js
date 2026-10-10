'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import Icon from '../../components/Icon';
import ReportButton from '../../components/ReportButton';

const MAX = 2000;
const POLL_VISIBLE = 5000;
const POLL_HIDDEN = 30000;
const TAIL_EVERY = 4; // co tyle odpytań odświeżamy też ostatnią stronę (cudze edycje i usunięcia nie zmieniają `after`)
const NEAR_BOTTOM = 80;

const hhmm = (iso) => new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
function dayLabel(iso) {
  const d = new Date(iso), now = new Date();
  const diff = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (diff === 0) return 'Dziś';
  if (diff === 1) return 'Wczoraj';
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' }) });
}

// Scala listy po id (nowsze dane z serwera zastępują starsze); wiadomości oczekujące (id tekstowe) zostają na końcu
function merge(prev, incoming) {
  const map = new Map();
  for (const m of prev) if (typeof m.id === 'number') map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  const real = [...map.values()].sort((a, b) => a.id - b.id);
  return [...real, ...prev.filter((m) => typeof m.id !== 'number')];
}

const lastId = (list) => { for (let i = list.length - 1; i >= 0; i--) if (typeof list[i].id === 'number') return list[i].id; return 0; };

// Czat grupy: lista wiadomości, polling `after` (5 s przy widocznej karcie, 30 s w tle), wysyłka z optymistycznym dodaniem.
export default function GroupChat({ groupId }) {
  const base = `/api/groups/${groupId}`;
  const [msgs, setMsgs] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [offline, setOffline] = useState(false);
  const [gone, setGone] = useState(false);
  const [more, setMore] = useState(false); // „Nowe wiadomości” poniżej
  const [announce, setAnnounce] = useState('');
  const box = useRef(null);
  const msgsRef = useRef([]);
  const stick = useRef(true); // czy lista jest przewinięta do dołu
  const keep = useRef(null); // wysokość listy sprzed wczytania starszych
  const readSent = useRef(0);
  const tmp = useRef(0);
  const hidden = useRef(false);
  msgsRef.current = msgs || [];
  const ready = msgs !== null;

  const nearBottom = () => { const el = box.current; return !el || el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM; };
  const toBottom = () => { const el = box.current; if (el) el.scrollTop = el.scrollHeight; setMore(false); };

  const markRead = useCallback((list) => {
    const id = lastId(list);
    if (!id || id <= readSent.current || document.visibilityState !== 'visible') return;
    readSent.current = id;
    api(`${base}/read`, 'POST', { upTo: id }).catch(() => { readSent.current = 0; });
  }, [base]);

  // Dołożenie wiadomości z serwera; ogłoszenie czytnikom tylko nowych cudzych
  const take = useCallback((incoming, { announceNew = false } = {}) => {
    const known = new Set(msgsRef.current.map((m) => m.id));
    const fresh = incoming.filter((m) => !known.has(m.id) && !m.mine && !m.deleted);
    if (announceNew && fresh.length) {
      setAnnounce(fresh.length === 1 ? `${fresh[0].name}: ${fresh[0].body || 'wiadomość'}` : `Nowe wiadomości: ${fresh.length}`);
      if (!nearBottom()) setMore(true);
    }
    setMsgs((prev) => { const next = merge(prev || [], incoming); msgsRef.current = next; return next; });
  }, []);

  // pierwsze wczytanie
  useEffect(() => {
    let alive = true;
    api(base + '/messages').then((r) => {
      if (!alive) return;
      setHasMore(r.hasMore); setMsgs(r.messages); msgsRef.current = r.messages; markRead(r.messages);
    }).catch((e) => { if (alive) { if (/Nie znaleziono/.test(e.message)) setGone(true); else setErr(e.message); setMsgs([]); } });
    return () => { alive = false; };
  }, [base, markRead]);

  // polling
  useEffect(() => {
    if (!ready || gone) return undefined;
    let timer, stopped = false, tick = 0, busy = false;
    const schedule = () => { clearTimeout(timer); if (!stopped) timer = setTimeout(poll, hidden.current ? POLL_HIDDEN : POLL_VISIBLE); };
    async function poll() {
      if (busy) return;
      busy = true;
      try {
        const after = lastId(msgsRef.current);
        const r = await api(`${base}/messages${after ? `?after=${after}` : ''}`);
        if (stopped) return;
        setOffline(false);
        if (r.messages.length) take(r.messages, { announceNew: true });
        if (++tick % TAIL_EVERY === 0) {
          const t = await api(base + '/messages');
          if (!stopped) take(t.messages);
        }
        // przeczytane tylko to, co widać: przewinięty w górę nie traci licznika nowych wiadomości
        if (nearBottom()) markRead([...msgsRef.current, ...r.messages]);
      } catch (e) {
        if (/Sesja wygasła/.test(e.message)) { setGone('session'); stopped = true; }
        else if (/Nie znaleziono/.test(e.message)) { setGone(true); stopped = true; } else setOffline(true);
      } finally { busy = false; schedule(); }
    }
    const onVis = () => { hidden.current = document.visibilityState !== 'visible'; if (!hidden.current) { clearTimeout(timer); poll(); } else schedule(); };
    hidden.current = document.visibilityState !== 'visible';
    document.addEventListener('visibilitychange', onVis);
    schedule();
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); };
  }, [ready, gone, base, take, markRead]);

  // przewijanie: do dołu po wczytaniu i dla własnych/przy dole; bez skoku po wczytaniu starszych
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || msgs === null) return;
    if (keep.current != null) { el.scrollTop += el.scrollHeight - keep.current; keep.current = null; return; }
    if (stick.current) toBottom();
  }, [msgs]);

  const onScroll = () => { stick.current = nearBottom(); if (stick.current) { setMore(false); markRead(msgsRef.current); } };

  async function older() {
    const first = msgs.find((m) => typeof m.id === 'number');
    if (!first) return;
    try {
      const r = await api(`${base}/messages?before=${first.id}`);
      keep.current = box.current.scrollHeight;
      setHasMore(r.hasMore);
      take(r.messages);
    } catch (e) { setErr(e.message); }
  }

  async function post(body, key) {
    try {
      const r = await api(base + '/messages', 'POST', { body });
      setMsgs((prev) => {
        const without = prev.filter((m) => m.id !== key);
        const next = without.some((m) => m.id === r.message.id) ? without : merge(without, [r.message]);
        msgsRef.current = next; return next;
      });
    } catch (e) {
      setMsgs((prev) => prev.map((m) => (m.id === key ? { ...m, failed: e.message } : m)));
    }
  }

  function send() {
    const body = text.trim();
    if (!body || body.length > MAX) return;
    setErr(''); setText('');
    stick.current = true;
    const key = `t${++tmp.current}`;
    setMsgs((prev) => [...prev, { id: key, mine: true, body, name: 'Ty', createdAt: new Date().toISOString(), pending: true }]);
    post(body, key);
  }
  const retry = (m) => { setMsgs((prev) => prev.map((x) => (x.id === m.id ? { ...x, failed: null } : x))); post(m.body, m.id); };
  const drop = (m) => setMsgs((prev) => prev.filter((x) => x.id !== m.id));

  async function edit(m, body) {
    const r = await api(`${base}/messages/${m.id}`, 'PATCH', { body });
    setMsgs((prev) => merge(prev, [r.message]));
  }
  async function remove(m) {
    try { await api(`${base}/messages/${m.id}`, 'DELETE'); setMsgs((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted: true, body: '', canEdit: false, canDelete: false } : x))); }
    catch (e) { setErr(e.message); }
  }

  const onKey = (e) => {
    // Enter wysyła tylko z fizyczną klawiaturą; na telefonie Enter to nowa linia, wysyła przycisk
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && matchMedia('(pointer: fine)').matches) { e.preventDefault(); send(); }
  };

  if (gone === 'session') return <p className="muted social-note" role="alert">Sesja wygasła. <a href="/login">Zaloguj się ponownie</a>, aby wrócić do czatu.</p>;
  if (gone) return <p className="muted social-note" role="alert">Nie masz już dostępu do czatu tej grupy.</p>;

  let prevDay = null;
  const over = text.length > MAX;
  return (
    <section className="chat" aria-label="Czat grupy">
      <div className="chat-wrap">
        <div className="chat-list" ref={box} onScroll={onScroll} role="log" aria-live="off" aria-label="Wiadomości grupy" tabIndex={0}>
          {hasMore && <button type="button" className="btn text small chat-older" onClick={older}>Wczytaj starsze</button>}
          {msgs === null ? (
            <div className="skeleton chat-skel" role="status" aria-label="Wczytywanie wiadomości">
              {[['w60', false], ['w40', true], ['w80', false], ['w60', true]].map(([w, mine], i) => (
                <div key={i} className={`chat-row${mine ? ' mine' : ''}`}><span className="skel-dot" /><span className={`skel-bubble ${w}`}><span className="skel-line" /></span></div>
              ))}
            </div>
          ) : msgs.length === 0 ? <p className="muted chat-empty">Brak wiadomości. Napisz pierwszą.</p> : (
            <ul className="chat-msgs">
              {msgs.map((m) => {
                const dk = dayKey(m.createdAt), sep = dk !== prevDay;
                prevDay = dk;
                return (
                  <li key={m.id} className="chat-item">
                    {sep && <div className="chat-day"><span>{dayLabel(m.createdAt)}</span></div>}
                    <Bubble m={m} onEdit={edit} onRemove={remove} onRetry={retry} onDrop={drop} />
                  </li>);
              })}
            </ul>)}
        </div>
        {more && <button type="button" className="btn small chat-new" onClick={toBottom}><Icon name="chevronDown" size={18} />Nowe wiadomości</button>}
      </div>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announce}</div>
      {offline && <p className="muted small chat-offline" role="status">Brak połączenia, spróbuję ponownie.</p>}
      {err && <p className="field-err" role="alert">{err}</p>}
      <p className="muted small chat-rule">Nie udzielamy tu porad medycznych. Nie oferuj sprzedaży ani wymiany leków. Nowi członkowie grupy widzą wcześniejsze wiadomości.</p>
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label htmlFor="chat-input" className="sr-only">Wiadomość do grupy</label>
        <textarea id="chat-input" className="input chat-input" rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
          placeholder="Napisz wiadomość…" aria-describedby="chat-count" enterKeyHint="send" />
        <button className="btn chat-send" disabled={!text.trim() || over} aria-label="Wyślij wiadomość">Wyślij</button>
        <span id="chat-count" className={`chat-count small${over || text.length > MAX - 100 ? ' warn' : ''}`}>{text.length}/{MAX}</span>
      </form>
    </section>
  );
}

function Bubble({ m, onEdit, onRemove, onRetry, onDrop }) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const mid = `cm-${m.id}`;
  const stamp = `${hhmm(m.createdAt)}${m.editedAt ? ' · edytowano' : ''}`;

  async function save(e) {
    e.preventDefault();
    try { await onEdit(m, draft.trim()); setEditing(false); setMenu(false); setErr(''); } catch (x) { setErr(x.message); }
  }
  return (
    <div className={`chat-row${m.mine ? ' mine' : ''}`}>
      {!m.mine && (m.hasAvatar ? <img className="avatar sm" src={`/api/users/${m.userId}/avatar`} alt="" />
        : <span className="avatar ph sm" aria-hidden="true">{(m.name || '?').trim()[0]?.toUpperCase()}</span>)}
      <div className="chat-main">
        <div className={`chat-bubble${m.deleted ? ' gone' : ''}${m.pending && !m.failed ? ' pending' : ''}`}>
          {!m.mine && <span className="chat-name">{m.name}</span>}
          {m.deleted ? <span className="chat-body">Wiadomość usunięta</span>
            : m.locked ? <span className="chat-body">Wiadomość nieczytelna (brak klucza szyfrowania).</span>
            : editing ? (
              <form onSubmit={save} className="chat-edit">
                <label htmlFor={`${mid}-e`} className="sr-only">Edytuj wiadomość</label>
                <textarea id={`${mid}-e`} className="input" rows={3} maxLength={MAX} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                <div className="row">
                  <button className="btn small" disabled={!draft.trim()}>Zapisz</button>
                  <button type="button" className="btn text small" onClick={() => { setEditing(false); setErr(''); }}>Anuluj</button>
                </div>
                {err && <p className="field-err" role="alert">{err}</p>}
              </form>
            ) : <span className="chat-body">{m.body}</span>}
          <span className="chat-meta">{m.failed ? 'Nie wysłano' : m.pending ? 'Wysyłam…' : stamp}</span>
        </div>
        {m.failed && (
          <div className="chat-actions">
            <span className="field-err" role="alert">{m.failed}</span>
            <button type="button" className="btn text small" onClick={() => onRetry(m)}>Ponów</button>
            <button type="button" className="btn text small" onClick={() => onDrop(m)}>Usuń</button>
          </div>)}
        {!m.pending && !m.deleted && !editing && (
          <div className="chat-actions">
            <button type="button" className="btn text small chat-more" aria-expanded={menu} aria-controls={`${mid}-menu`}
              aria-label={`Opcje wiadomości${m.mine ? '' : ` od ${m.name}`}`} onClick={() => setMenu(!menu)}><Icon name="more" size={20} /></button>
            {menu && (
              <span id={`${mid}-menu`} className="chat-menu">
                {m.canEdit && <button type="button" className="btn text small" onClick={() => { setDraft(m.body); setEditing(true); }}>Edytuj</button>}
                {m.canDelete && <button type="button" className="btn text small" onClick={() => confirm('Usunąć wiadomość?') && onRemove(m)}>Usuń</button>}
                {!m.mine && <ReportButton type="message" refId={m.id} label="Zgłoś" />}
              </span>)}
          </div>)}
      </div>
    </div>
  );
}
