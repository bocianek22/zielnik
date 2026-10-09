// Kształt punktu: przy pojedynczym dniu bez linii tylko on odróżnia objawy (obok koloru)
export function Marker({ shape, x, y, color, r = 3.5 }) {
  const common = { fill: color, stroke: 'var(--surface)', strokeWidth: 1 };
  if (shape === 'square') return <rect x={x - r * 0.85} y={y - r * 0.85} width={r * 1.7} height={r * 1.7} {...common} />;
  if (shape === 'triangle') return <path d={`M${x},${y - r * 1.1}L${x + r},${y + r * 0.75}L${x - r},${y + r * 0.75}Z`} {...common} />;
  if (shape === 'cross') return <path d={`M${x - r},${y}H${x + r}M${x},${y - r}V${y + r}`} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />;
  if (shape === 'ring') return <circle cx={x} cy={y} r={r * 0.9} fill="var(--surface)" stroke={color} strokeWidth="2" />;
  if (shape === 'down') return <path d={`M${x},${y + r * 1.1}L${x + r},${y - r * 0.75}L${x - r},${y - r * 0.75}Z`} {...common} />;
  if (shape === 'diamond') return <path d={`M${x},${y - r * 1.2}L${x + r * 1.05},${y}L${x},${y + r * 1.2}L${x - r * 1.05},${y}Z`} {...common} />;
  return <circle cx={x} cy={y} r={r} {...common} />;
}

// Próbka do legendy: ta sama kreska i ten sam punkt co na wykresie
export function Swatch({ s }) {
  return (
    <svg className="sym-swatch" viewBox="0 0 28 12" width="28" height="12" aria-hidden="true">
      <line x1="1" x2="27" y1="6" y2="6" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash || undefined} />
      <Marker shape={s.marker} x={14} y={6} color={s.color} />
    </svg>
  );
}
