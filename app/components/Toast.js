'use client';
import { useEffect } from 'react';

// Jedno potwierdzenie zapisu dla całej aplikacji (docs/UI-2.md, U9): krótki komunikat nad dolnym paskiem, opcjonalnie z „Cofnij”.
// Obszar role="status" jest zawsze w DOM (pusty = nic nie widać), żeby czytnik ekranu zgłaszał zmiany tekstu.
// Przycisk jest poza tym obszarem, żeby czytnik nie czytał go przy każdej zmianie.
// Czas pokazywania liczy wywołujący (np. useQuickSave, bo „Cofnij” ma dłuższe okno) albo sam Toast przez onClose + duration.
// tone: 'ok' | 'warn' | 'queued'; action: { label, busyLabel, busy, onClick }
export const TOAST_MS = 4000;

export default function Toast({ text, tone = 'ok', action = null, onClose = null, duration = TOAST_MS }) {
  useEffect(() => {
    if (!text || !onClose || !duration) return undefined;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [text, onClose, duration]);
  return (
    <div className={`toast${tone !== 'ok' ? ` ${tone}` : ''}`} data-empty={!text && !action ? '' : undefined}>
      <p className="toast-text quick-msg" role="status" aria-live="polite">{text || ''}</p>
      {action && (
        <button type="button" className="btn small ghost undo-btn" disabled={!!action.busy} aria-busy={action.busy || undefined} onClick={action.onClick}>
          {action.busy ? action.busyLabel || action.label : action.label}
        </button>
      )}
    </div>
  );
}
