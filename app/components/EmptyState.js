import Illustration from './Illustration';

// Pusty stan (docs/DESIGN-3.1.md): ilustracja w kolorze obszaru, tytuł, jedno zdanie i najwyżej jedna akcja.
// art: nazwa z Illustration.js; cat: obszar (data-cat); card: w karcie (domyślnie) albo bez tła; headingLevel: 2 albo 3.
// Klasa .empty zostaje (testy i istniejące style), więc można nią zastępować dawne <div className="card empty">.
export default function EmptyState({ art = 'jar', cat, title, children, action = null, card = true, headingLevel = 2, id, className = '' }) {
  const H = headingLevel === 3 ? 'h3' : 'h2';
  return (
    <div className={`${card ? 'card ' : ''}empty empty-state ${className}`.trim()} data-cat={cat}>
      <Illustration art={art} />
      {title && <H id={id}>{title}</H>}
      {children && <p className="muted">{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
