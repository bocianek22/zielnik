'use client';
import { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import { isNative, nativePrint } from '../components/native/bridge';
import { isDiscreet } from '@/lib/discreet';
import { reportTitle } from '@/lib/shortcuts';
import { NOTES_EVENT } from './ReportNotes';

// Przeglądarka: „Drukuj” (okno drukowania z „Zapisz jako PDF”; tytuł strony staje się nazwą pliku, więc na czas druku go podmieniamy),
// „Pobierz PDF” i, gdy przeglądarka umie udostępniać pliki (telefon), „Udostępnij PDF”. PDF powstaje lokalnie (lib/report-pdf.js,
// ładowane dopiero po kliknięciu). Aplikacja Android: WebView nie pobiera plików z blob: ani nie udostępnia ich (Web Share nie działa),
// więc zostaje wtyczka ZielnikPrint z systemowym oknem druku (mobile/README.md). Tryb dyskretny sprawdzamy w chwili dotknięcia.
export default function ReportActions({ from, to, model, notes: initialNotes }) {
  const [caps, setCaps] = useState(null); // { native, share } po zamontowaniu (serwer tego nie wie)
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(null); // 'download' | 'share'
  const [err, setErr] = useState('');

  useEffect(() => {
    const native = isNative();
    let share = false;
    try {
      share = !native && typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['%PDF'], 'raport.pdf', { type: 'application/pdf' })] });
    } catch { share = false; }
    setCaps({ native, share });
    const on = (e) => setNotes(e.detail);
    window.addEventListener(NOTES_EVENT, on);
    return () => window.removeEventListener(NOTES_EVENT, on);
  }, []);

  const print = () => {
    const title = reportTitle(from, to, isDiscreet());
    const native = nativePrint(title);
    if (native) { native.catch(() => window.alert('Nie udało się otworzić okna drukowania. Spróbuj ponownie.')); return; }
    const prev = document.title;
    document.title = title;
    const restore = () => { document.title = prev; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
  };

  const make = async () => {
    const { buildReportPdf } = await import('@/lib/report-pdf');
    const bytes = await buildReportPdf({ ...model, title: reportTitle(from, to, isDiscreet()) }, notes);
    return new File([bytes], model.fileName, { type: 'application/pdf' });
  };

  const run = (kind) => async () => {
    setErr(''); setBusy(kind);
    try {
      const file = await make();
      if (kind === 'share') {
        await navigator.share({ files: [file], title: 'Raport' });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url; a.download = file.name; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch (e) {
      if (e?.name !== 'AbortError') setErr(kind === 'share' ? 'Nie udało się udostępnić PDF. Spróbuj „Pobierz PDF”.' : 'Nie udało się utworzyć PDF. Spróbuj „Drukuj” i „Zapisz jako PDF”.');
    } finally { setBusy(null); }
  };

  const pdf = caps && !caps.native;
  return (
    <div className="report-actions no-print">
      <button type="button" className="btn" onClick={print}><Icon name="share" size={18} />{caps?.native ? 'Udostępnij / Zapisz PDF' : 'Drukuj'}</button>
      {pdf && <button type="button" className="btn ghost" onClick={run('download')} disabled={busy != null} aria-busy={busy === 'download' || undefined}>
        <Icon name="file" size={18} />{busy === 'download' ? 'Tworzę PDF…' : 'Pobierz PDF'}</button>}
      {pdf && caps.share && <button type="button" className="btn ghost" onClick={run('share')} disabled={busy != null} aria-busy={busy === 'share' || undefined}>
        <Icon name="share" size={18} />{busy === 'share' ? 'Tworzę PDF…' : 'Udostępnij PDF'}</button>}
      {err && <div className="alert error" role="alert">{err}</div>}
    </div>
  );
}
