import Link from 'next/link';

// Przełącznik widoków odmian: Moje / Katalog / Rankingi (wspólny dla /odmiany, /katalog i /rankings)
const TABS = [['moje', '/odmiany', 'Moje'], ['katalog', '/katalog', 'Katalog'], ['rankingi', '/rankings', 'Rankingi']];

export default function StrainsNav({ current }) {
  return (
    <nav className="seg seg-links" aria-label="Widok odmian">
      {TABS.map(([key, href, label]) => (
        key === current
          ? <Link key={key} href={href} className="on" aria-current="page">{label}</Link>
          : <Link key={key} href={href}>{label}</Link>
      ))}
    </nav>
  );
}
