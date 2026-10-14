'use client';
import { nativePrint } from '../../components/native/bridge';
import Icon from '../../components/Icon';

// Druk karty: w APK przez wtyczkę drukowania, w przeglądarce window.print() (tytuł pliku PDF neutralny)
export default function PrintCard() {
  const print = () => {
    const native = nativePrint('karta');
    if (native) { native.catch(() => window.alert('Nie udało się otworzyć okna drukowania. Spróbuj ponownie.')); return; }
    const prev = document.title;
    document.title = 'karta';
    const restore = () => { document.title = prev; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
  };
  return <button type="button" className="btn" onClick={print}><Icon name="file" size={18} />Drukuj lub zapisz PDF</button>;
}
