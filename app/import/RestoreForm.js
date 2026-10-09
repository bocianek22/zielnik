'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import Icon from '@/app/components/Icon';

const MAX = 4 * 1024 * 1024; // jak MAX_BODY na serwerze (Vercel: najwyżej 4,5 MB treści)

// Zdjęcia nie są przenoszone, a ważą najwięcej: zostaje tylko znacznik, że były (limit pliku 5 MB)
function slim(d) {
  const out = { ...d };
  if (out.avatar) out.avatar = true;
  if (Array.isArray(out.strainPhotosAdded)) out.strainPhotosAdded = out.strainPhotosAdded.map(() => ({ has_photo: true }));
  if (Array.isArray(out.tests)) out.tests = out.tests.map(({ photo_base64, blob_path, mime, ...t }) => ({ ...t, has_photo: !!(t.has_photo || photo_base64 || blob_path || mime) }));
  return out;
}

function Summary({ r }) {
  return (
    <>
      {r.sections.length > 0 && (
        <ul className="import-sum">
          {r.sections.map((s) => (
            <li key={s.key}>
              <b>{s.label}:</b> {r.dryRun ? 'do dodania' : 'dodano'} {s.added}
              {s.existing > 0 && <>, już są: {s.existing}</>}
              {s.missing > 0 && <>, brak w katalogu: {s.missing}</>}
              {s.invalid > 0 && <>, odrzucone: {s.invalid}</>}
              {s.limit > 0 && <>, ponad limit: {s.limit}</>}
            </li>
          ))}
        </ul>
      )}
      {r.unmatchedCount > 0 && (
        <p>Pominięte odmiany spoza katalogu ({r.unmatchedCount}): {r.unmatched.map((u) => u.name).join(', ')}{r.unmatchedCount > r.unmatched.length && '…'}</p>
      )}
      {r.notes.map((t) => <p key={t}>{t}</p>)}
      {r.notImported.length > 0 && <p>Nie są przenoszone: {r.notImported.join(', ')}.</p>}
    </>
  );
}

export default function RestoreForm() {
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setData(null); setPreview(null); setResult(null); setError('');
    if (!file) return;
    if (file.size > 40e6) return setError('Plik jest bardzo duży. Użyj pliku „Pobierz dane (JSON)” bez zdjęć.');
    let d;
    try { d = JSON.parse(await file.text()); } catch { return setError('Nie udało się odczytać pliku (oczekiwano pliku JSON z eksportu).'); }
    if (!d || typeof d !== 'object' || Array.isArray(d)) return setError('To nie jest plik eksportu danych.');
    d = slim(d);
    if (new Blob([JSON.stringify({ dryRun: true, data: d })]).size > MAX) return setError('Plik jest za duży (najwyżej 4 MB bez zdjęć).');
    setBusy(true);
    try { setPreview(await api('/api/account/import', 'POST', { dryRun: true, data: d })); setData(d); setName(file.name); }
    catch (err) { setError(err.message); }
    setBusy(false);
  }

  async function run() {
    setBusy(true); setError('');
    try { setResult(await api('/api/account/import', 'POST', { data })); setPreview(null); setData(null); }
    catch (err) { setError(err.message); }
    setBusy(false);
  }

  return (
    <div className="import-form" id="kopia">
      <h2 className="section-label">Przywróć z kopii (plik JSON z eksportu)</h2>
      <div className="card stack">
        <p className="import-help">Wybierz plik pobrany w profilu („Pobierz dane (JSON)”). Najpierw zobaczysz podsumowanie, nic nie zostanie zapisane, dopóki nie klikniesz „Importuj”. Odzyskasz własne wpisy: oceny, stany, notatki, zużycie, zakupy, recepty, testy, dziennik i punkty do omówienia (jako prywatne). Pozycje, które już masz, zostają bez zmian, więc ten sam plik można wgrać ponownie. Odmiany spoza katalogu, znajomi, grupy, zdjęcia i dane innych osób nie są przenoszone.</p>
        <label className="btn ghost block file-btn"><Icon name="download" size={20} className="flip" />Wybierz plik JSON<input type="file" accept=".json,application/json" className="sr-only" disabled={busy} onChange={pick} /></label>
      </div>
      <div aria-live="polite">{preview && (
        <>
          <h2 className="section-label">Podgląd: {name}</h2>
          <div className="card stack">
            <Summary r={preview} />
            <div className="import-run">
              <span>Do dodania łącznie: <b>{preview.total.added}</b></span>
              <button className="btn" disabled={busy || preview.total.added === 0} onClick={run}>{busy ? 'Importuję…' : 'Importuj'}</button>
            </div>
          </div>
        </>
      )}</div>
      {error && <div className="alert error" role="alert">{error}</div>}
      {result && <div className="alert note" role="status"><p>Zaimportowano. Dodano łącznie: <b>{result.total.added}</b>.</p><Summary r={result} /></div>}
    </div>
  );
}
