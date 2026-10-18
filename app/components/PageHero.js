import Icon from './Icon';

// UI 5, spójność: jeden nagłówek ekranu dla wszystkich obszarów (pastelowe tło w kolorze obszaru, kółko z ikoną, tytuł,
// podtytuł). `aside` stoi po prawej (np. przycisk szukania), `children` pod spodem (np. przyciski w .hero-actions).
export default function PageHero({ cat, icon, title, sub, h1Props, aside, className = '', children }) {
  return (
    <header className={`hero cat-hero ${className}`.trim()} data-cat={cat}>
      <div className="hero-top">
        <span className="ic-dot sq" aria-hidden="true"><Icon name={icon} size={24} /></span>
        <div>
          <h1 {...h1Props}>{title}</h1>
          {sub && <p className="hero-sub">{sub}</p>}
        </div>
        {aside && <div className="hero-aside">{aside}</div>}
      </div>
      {children}
    </header>
  );
}
