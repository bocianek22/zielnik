'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { newRequestId } from '@/lib/ids';

const UNDO_MS = 8000; // tyle widać „Cofnij” (serwer pozwala cofnąć wpis przez 10 minut)
const RETRY_MS = 120000; // requestId po błędzie służy do ponowienia tylko przez 2 minuty, potem to już nowy zapis

// Zapis zużycia lub wykupu (kind: 'usage' | 'purchase') z requestId i komunikatem „Zapisano … · Cofnij” (POM-02).
// requestId zostaje ten sam przy ponowieniu po błędzie z tą samą ilością (serwer nie zapisze drugi raz),
// a nowy powstaje po udanym zapisie, przy zmianie ilości, po 2 minutach i przy otwarciu panelu (renew).
export function useQuickSave(strainId) {
  const rid = useRef({ key: '', id: '', at: 0 });
  const [note, setNote] = useState(null); // { text, warn, undo: { kind, id } | null }
  const [undoing, setUndoing] = useState(false);
  const timer = useRef(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); }; }, []);

  function show(text, warn = false, undo = null) {
    clearTimeout(timer.current);
    setNote({ text, warn, undo });
    timer.current = setTimeout(() => { if (mounted.current) setNote(null); }, undo ? UNDO_MS : 10000);
  }

  async function save(kind, grams) {
    const key = `${kind}:${grams}`;
    if (rid.current.key !== key || Date.now() - rid.current.at > RETRY_MS) rid.current = { key, id: newRequestId(), at: Date.now() };
    const r = await api(`/api/strains/${strainId}/${kind}`, 'POST', { grams, requestId: rid.current.id });
    rid.current = { key: '', id: '', at: 0 };
    return r;
  }

  // cofa wpis pokazany w komunikacie; zwraca odpowiedź serwera (nowy stan) albo null przy błędzie
  async function undo() {
    const u = note?.undo;
    if (!u || undoing) return null;
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
      <p className={`${className}${note?.warn ? ' warn' : ''}`} role="status" aria-live="polite">{note?.text || ''}</p>
      {note?.undo && (
        <button type="button" className="btn small ghost undo-btn" disabled={undoing} onClick={onUndo}>
          {undoing ? 'Cofam…' : 'Cofnij'}
        </button>
      )}
    </div>
  );
}
