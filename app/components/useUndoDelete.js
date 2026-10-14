'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export const UNDO_DELETE_MS = 8000;

// „Cofnij” po usunięciu: usunięcie idzie na serwer od razu (dane zdrowotne nie zostają w bazie, gdy aplikacja zostanie
// zamknięta), a „Cofnij” przez UNDO_DELETE_MS odtwarza wpis z migawki zrobionej przed usunięciem.
// offer(text, restore): restore() zwraca obietnicę; błąd odtworzenia trafia do `error`.
export default function useUndoDelete() {
  const [undo, setUndo] = useState(null); // { text, restore }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const offer = useCallback((text, restore) => {
    clearTimeout(timer.current);
    setError('');
    setUndo({ text, restore });
    timer.current = setTimeout(() => setUndo(null), UNDO_DELETE_MS);
  }, []);

  const run = useCallback(async () => {
    if (!undo || busy) return;
    clearTimeout(timer.current);
    setBusy(true);
    try { await undo.restore(); setUndo(null); } catch (e) { setError(e.message); setUndo(null); } finally { setBusy(false); }
  }, [undo, busy]);

  return {
    offer, error, clear: () => { clearTimeout(timer.current); setUndo(null); },
    // dla <Toast>
    toast: undo ? { text: undo.text, action: { label: 'Cofnij', busyLabel: 'Przywracam…', busy, onClick: run } } : null,
  };
}
