import Icon from './Icon';

// Nagłówek karty (Design 3): kółko z ikoną w kolorze obszaru + tytuł; kolory z data-cat (stock|journal|rx|strain|social|learn)
export default function SecHead({ cat, icon, id, children, action }) {
  return (
    <div className="sec-head" data-cat={cat}>
      <span className="ic-dot sm"><Icon name={icon} size={20} /></span>
      <h2 id={id}>{children}</h2>
      {action}
    </div>
  );
}
