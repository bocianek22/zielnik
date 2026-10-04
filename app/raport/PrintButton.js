'use client';
import Icon from '../components/Icon';
import { nativePrint } from '../components/native/bridge';
import { isDiscreet } from '@/lib/discreet';
import { reportTitle } from '@/lib/shortcuts';

// Przeglądarka: okno drukowania z „Zapisz jako PDF”; tytuł strony staje się nazwą pliku, więc na czas druku go podmieniamy.
// Aplikacja Android: window.print() w WebView nic nie robi, więc systemowe okno druku otwiera wtyczka natywna
// (ZielnikPrint, mobile/README.md). Tryb dyskretny sprawdzamy w chwili dotknięcia (serwer go nie zna).
export default function PrintButton({ from, to }) {
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
  return <button type="button" className="btn no-print" onClick={print}><Icon name="share" size={18} />Udostępnij / Zapisz PDF</button>;
}
