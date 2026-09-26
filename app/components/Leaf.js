// Prosty liść konopi (7 listków), kolor z currentColor
export default function Leaf({ size = 32, className = '' }) {
  const blades = [
    { a: 0, ry: 40 }, { a: -28, ry: 34 }, { a: 28, ry: 34 },
    { a: -56, ry: 27 }, { a: 56, ry: 27 }, { a: -80, ry: 18 }, { a: 80, ry: 18 },
  ];
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" fill="currentColor">
      {blades.map((b, i) => (
        <ellipse key={i} cx="50" cy={86 - b.ry} rx={b.ry > 30 ? 6 : 5} ry={b.ry} transform={`rotate(${b.a} 50 86)`} />
      ))}
      <rect x="48.6" y="84" width="2.8" height="14" rx="1.4" />
    </svg>
  );
}
