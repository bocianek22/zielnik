// Kontener wykresu: <figure> z nagłówkiem (tytuł + odczyt wybranej wartości, aria-live), wykresem, osią X w HTML (prawdziwe 12 px,
// nie skalowany viewBox) i tabelą dla czytnika ekranu w .sr-only. Bez tytułu i odczytu nagłówka nie ma.
// Klasy ekranu (np. `usage`, `uchart`) przychodzą z zewnątrz, żeby wygląd przy wydzieleniu z ekranów się nie zmienił.
export default function Frame({ className = '', title, titleClass, titleTag: Title = 'h3', headClass, read, readClass, children, axis, table }) {
  return (
    <figure className={`chart-frame${className ? ` ${className}` : ''}`}>
      {(title || read != null) && (
        <div className={headClass}>
          {title && <Title className={titleClass}>{title}</Title>}
          {read != null && <p className={readClass} aria-live="polite">{read}</p>}
        </div>
      )}
      {children}
      {axis}
      {table && <div className="sr-only">{table}</div>}
    </figure>
  );
}
