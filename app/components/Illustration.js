// Mikroilustracje z prostych kształtów (docs/DESIGN-3.md, zasada 8: bez liści i postaci) w kolorach obszaru:
// --c (wypełnienie), --c-soft (tło), --c-ink (kontur), --surface (papier). Kolory przez klasy .ill-* w globals.css,
// bo var() w atrybutach SVG nie działa wszędzie. Bez 'use client': działa w komponentach serwerowych i klienckich.
const A = {
  jar: <>
    <rect className="ill-fill" x="44" y="30" width="32" height="46" rx="7" />
    <rect className="ill-ink" x="41" y="22" width="38" height="10" rx="3" />
    <rect className="ill-paper" x="49" y="44" width="22" height="16" rx="3" />
    <path className="ill-line" d="M53 50h14M53 55h9" />
  </>,
  journal: <>
    <rect className="ill-paper ill-edge" x="36" y="20" width="48" height="58" rx="6" />
    <path className="ill-line" d="M45 32h30M45 40h22" />
    <path className="ill-stroke" d="M44 62h8l4-10 7 16 4-8h9" />
  </>,
  rx: <>
    <rect className="ill-paper ill-edge" x="34" y="18" width="44" height="58" rx="6" />
    <path className="ill-line" d="M43 30h26M43 38h20M43 46h24" />
    <circle className="ill-fill" cx="76" cy="66" r="13" />
    <path className="ill-check" d="m70 66 4.5 4.5L82 62" />
  </>,
  group: <>
    <circle className="ill-ink" cx="60" cy="38" r="9" />
    <path className="ill-fill" d="M44 72a16 16 0 0 1 32 0z" />
    <circle className="ill-paper ill-edge" cx="38" cy="46" r="7" />
    <circle className="ill-paper ill-edge" cx="82" cy="46" r="7" />
    <path className="ill-paper ill-edge" d="M26 74a12 12 0 0 1 22-6M94 74a12 12 0 0 0-22-6" />
  </>,
  friends: <>
    <circle className="ill-ink" cx="49" cy="38" r="9" />
    <path className="ill-fill" d="M33 74a16 16 0 0 1 32 0z" />
    <circle className="ill-paper ill-edge" cx="73" cy="42" r="8" />
    <path className="ill-paper ill-edge" d="M59 74a14 14 0 0 1 28 0z" />
  </>,
  search: <>
    <circle className="ill-paper ill-edge-thick" cx="55" cy="46" r="18" />
    <path className="ill-stroke-thick" d="m68 59 13 13" />
    <path className="ill-line" d="M47 42h16M47 50h10" />
  </>,
  chart: <>
    <rect className="ill-paper ill-edge" x="28" y="22" width="64" height="54" rx="6" />
    <rect className="ill-fill" x="38" y="52" width="8" height="16" rx="2" />
    <rect className="ill-fill" x="51" y="42" width="8" height="26" rx="2" />
    <rect className="ill-fill" x="64" y="48" width="8" height="20" rx="2" />
    <rect className="ill-ink" x="77" y="34" width="8" height="34" rx="2" />
  </>,
  report: <>
    <rect className="ill-paper ill-edge" x="36" y="22" width="48" height="56" rx="6" />
    <rect className="ill-ink" x="50" y="17" width="20" height="10" rx="3" />
    <path className="ill-line" d="M45 40h30M45 48h30M45 56h18" />
    <path className="ill-stroke" d="M45 66h8l3-5 4 7 3-4h12" />
  </>,
};

export default function Illustration({ art = 'jar', size = 120, className = '' }) {
  return (
    <svg className={`ill ${className}`.trim()} width={size} height={size * 0.8} viewBox="0 0 120 96" aria-hidden="true" focusable="false">
      <ellipse className="ill-bg" cx="60" cy="50" rx="52" ry="42" />
      {A[art] || A.jar}
    </svg>
  );
}
