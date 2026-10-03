'use client';
import Icon from '../components/Icon';

// Wydruk z przeglądarki: „Zapisz jako PDF” w oknie drukowania albo udostępnienie wydruku z telefonu.
// Tytuł strony staje się nazwą pliku PDF, więc na czas drukowania ustawiamy go na opis raportu.
export default function PrintButton({ title }) {
  const print = () => {
    const prev = document.title;
    if (title) document.title = title;
    const restore = () => { document.title = prev; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
  };
  return <button type="button" className="btn no-print" onClick={print}><Icon name="share" size={18} />Udostępnij / Zapisz PDF</button>;
}
