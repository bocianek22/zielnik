// Poziome paski z wartością na końcu, w HTML (tekst ma prawdziwe 12-14 px, nic się nie skaluje). Serwerowy, bez stanu.
//  items: [{ key, value (liczba albo null = brak danych), text (podpis wartości), tone: 'data' | 'ref', label? (podpis wiersza po lewej) }]
//  max: wartość pełnego toru (wspólna dla wierszy jednej pary, żeby długości dało się porównać)
// Pasek jest dekoracją (aria-hidden w wywołującym); wartości stoją też jako tekst.
export default function HBars({ items, max, className = '' }) {
  return (
    <div className={`hb${className ? ` ${className}` : ''}`}>
      {items.map((it) => (
        <div key={it.key} className={`hb-row${it.label ? ' lbl' : ''}`}>
          {it.label && <span className="hb-lbl">{it.label}</span>}
          <span className="hb-track">
            {it.value > 0 && max > 0 && <i className={`hb-bar ${it.tone}`} style={{ width: `${Math.min(100, (it.value / max) * 100)}%` }} />}
          </span>
          <b className="hb-val">{it.text}</b>
        </div>
      ))}
    </div>
  );
}
