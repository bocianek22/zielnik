import Icon from './Icon';
import SecHead from './SecHead';

// Zwijana sekcja szczegółów (Design 3.1): nagłówek jak .sec-head (kółko w kolorze obszaru, tytuł), strzałka po prawej.
// Bez stanu i bez 'use client': <details> zwija się natywnie, więc działa także w komponentach serwerowych.
export default function Fold({ cat, icon, title, count = null, open = false, className = '', id, children }) {
  return (
    <details className={`card fold ${className}`.trim()} data-cat={cat} open={open || undefined} id={id}>
      <summary>
        <span className="ic-dot sm"><Icon name={icon} size={20} /></span>
        <span className="fold-title">{title}</span>
        {count != null && <span className="fold-count">{count}</span>}
        <Icon name="chevronDown" size={20} className="chev" />
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

// Ta sama sekcja jako zwijana (fold) albo zwykła karta z nagłówkiem; zdefiniowana poza komponentami, żeby nie montować ich dzieci od nowa
export function Section({ fold = false, cat, icon, title, count, open, className = '', id, children }) {
  if (fold) return <Fold cat={cat} icon={icon} title={title} count={count} open={open} className={className} id={id}>{children}</Fold>;
  return (
    <section className={`card ${className}`.trim()} id={id}>
      <SecHead cat={cat} icon={icon}>{title}</SecHead>
      {children}
    </section>
  );
}
