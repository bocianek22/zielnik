'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { newRequestId } from '@/lib/ids';
import { saveOrQueue, removeQueued } from '@/lib/offline-client';
import useQueueEvents from './useQueueEvents';

const UNDO_MS = 8000; // tyle widać „Cofnij” (serwer pozwala cofnąć wpis przez 10 minut)
const QUEUED_MS = 30000; // „czeka na wysłanie” z „Cofnij” (potem licznik w nagłówku)
const RETRY_MS = 120000; // requestId po błędzie służy do ponowienia tylko przez 2 minuty, potem to już nowy zapis

// Zapis zużycia lub wykupu (kind: 'usage' | 'purchase') z requestId i komunikatem „Zapisano … · Cofnij” (POM-02).
// requestId zostaje ten sam przy ponowieniu po błędzie z tą samą ilością (serwer nie zapisze drugi raz),
// a nowy powstaje po udanym zapisie, przy zmianie ilości, po 2 minutach i przy otwarciu panelu (renew).
// Bez sieci zapis trafia do kolejki offline (POM-14): save zwraca { queued: pozycja }, a wywołujący pokazuje stan
// od razu („czeka na wysłanie”); „Cofnij” usuwa wtedy pozycję z kolejki zamiast wpisu na serwerze.
export function useQuickSave(strainId) {
  const rid = useRef({ key: '', id: '', at: 0 });
  const [note, setNote] = useState(null); // { text, warn, undo: { kind, id } | null }
  const [undoing, setUndoing] = useState(false);
  const timer = useRef(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); }; }, []);
  // komunikat „czeka na wysłanie” zmienia się, gdy kolejka wyśle, usunie albo serwer odrzuci ten zapis
  useQueueEvents((d) => {
    if (!['sent', 'rejected', 'removed'].includes(d.type) || note?.undo?.queued !== d.item.id) return;
    const usage = d.item.kind === 'usage';
    if (d.type === 'sent') show(usage ? 'Wysłano zapis zużycia.' : 'Wysłano zapis wykupu.');
    else if (d.type === 'removed') show(usage ? 'Usunięto zapis zużycia z kolejki.' : 'Usunięto zapis wykupu z kolejki.');
    else show(`Nie zapisano: ${d.message}`, true);
  });

  function show(text, warn = false, undo = null) {
    clearTimeout(timer.current);
    setNote({ text, warn, undo });
    timer.current = setTimeout(() => { if (mounted.current) setNote(null); }, undo?.queued ? QUEUED_MS : undo ? UNDO_MS : 10000);
  }

  // meta: { name, unit } do etykiety w panelu kolejki oraz { delta, poolDelta }: o ile interfejs od razu zmienił
  // stan i pulę (lista cofa to, gdy zapis zostanie usunięty z kolejki albo odrzucony)
  async function save(kind, grams, meta = {}) {
    const key = `${kind}:${grams}`;
    if (rid.current.key !== key || Date.now() - rid.current.at > RETRY_MS) rid.current = { key, id: newRequestId(), at: Date.now() };
    const r = await saveOrQueue({ kind, url: `/api/strains/${strainId}/${kind}`, body: { grams, requestId: rid.current.id }, meta: { ...meta, strainId, grams } });
    rid.current = { key: '', id: '', at: 0 };
    return r.queued ? { queued: r.queued } : r.data;
  }

  // cofa wpis pokazany w komunikacie; zwraca odpowiedź serwera (nowy stan), { queued } dla zapisu usuniętego
  // z kolejki (stan cofa wywołujący, bo zna go tylko on) albo null przy błędzie
  async function undo() {
    const u = note?.undo;
    if (!u || undoing) return null;
    // zapis z kolejki: usuwamy pozycję, a stan cofa lista po zdarzeniu „removed” (tak samo jak przy „Usuń” w panelu kolejki)
    if (u.queued) {
      if (!(await removeQueued(u.queued)) && mounted.current) show('Ten zapis jest właśnie wysyłany, nie można go już cofnąć tutaj.', true);
      return null;
    }
    setUndoing(true);
    try {
      const r = await api(`/api/strains/${strainId}/${u.kind}`, 'DELETE', { id: u.id });
      if (mounted.current) show(u.kind === 'usage' ? 'Cofnięto zapis zużycia.' : 'Cofnięto zapis wykupu.');
      return r;
    } catch (e) {
      if (mounted.current) show(e.message, true);
      return null;
    } finally {
      if (mounted.current) setUndoing(false);
    }
  }

  return { save, show, undo, note, undoing, renew: () => { rid.current = { key: '', id: '', at: 0 }; }, clear: () => { clearTimeout(timer.current); setNote(null); } };
}

// Komunikat po zapisie z przyciskiem „Cofnij” (przycisk poza obszarem role="status", żeby czytnik nie czytał go w kółko)
export function SaveNote({ note, undoing, onUndo, className = 'quick-msg' }) {
  return (
    <div className="save-note">
      <p className={`${className}${note?.warn ? ' warn' : ''}${note?.undo?.queued ? ' queued' : ''}`} role="status" aria-live="polite">{note?.text || ''}</p>
      {note?.undo && (
        <button type="button" className="btn small ghost undo-btn" disabled={undoing} onClick={onUndo}>
          {undoing ? 'Cofam…' : 'Cofnij'}
        </button>
      )}
    </div>
  );
}
