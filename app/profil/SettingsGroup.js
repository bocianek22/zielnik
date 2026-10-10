import Icon from '../components/Icon';

// Zwijana grupa ustawień w stylu iOS: wiersz z kółkiem ikony, tytułem, krótką wartością po prawej i strzałką.
// Treść jest w DOM także po zwinięciu (details), więc stan komponentów-dzieci nie ginie.
export default function SettingsGroup({ icon, title, value, id, cat, danger = false, children }) {
  return (
    <details className={`card set-group${danger ? ' danger-zone' : ''}`} data-cat={cat} id={id}>
      <summary>
        <span className="ic-dot sm"><Icon name={icon} size={20} /></span>
        <span className="lr-main">{title}</span>
        {value && <span className="lr-value">{value}</span>}
        <Icon name="chevronRight" size={18} className="lr-chev" />
      </summary>
      <div className="set-body">{children}</div>
    </details>
  );
}
