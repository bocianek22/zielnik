'use client';
import Icon from './Icon';

// „Wróć” na stronach publicznych (regulamin, polityka): w aplikacji natywnej bywa jedyną drogą powrotu bez systemowego Wstecz.
// Bez historii (np. otwarte w nowej karcie) prowadzi na stronę główną.
export default function BackLink() {
  const back = (e) => {
    if (window.history.length > 1) { e.preventDefault(); window.history.back(); }
  };
  return <a href="/" className="back" onClick={back}><Icon name="chevronLeft" size={20} />Wróć</a>;
}
