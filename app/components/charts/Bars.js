import { barPath } from './scale';

// Słupki pionowe w viewBox o stałych pikselach (dni, tygodnie). Słupek i-ty: lewy brzeg x0 + i·slot, szerokość bw, wysokość
// proporcjonalna do `max` (hmax px dla max), zaokrąglony 4 px tylko u góry, zakotwiczony na `base`.
//  items: [{ key, value, title? }]    minH: minimalna wysokość niezerowego słupka    zeroH: wysokość znacznika zera (0 = brak)
//  hit: przezroczysty prostokąt na cały przedział (cel dotyku), onSelect(i) przy kliknięciu
//  extra(item, i, { x, y, h }): dodatkowa treść w grupie słupka (podpisy); children: treść pod słupkami (oś)
export default function Bars({ items, width, height, base = height, slot, x0 = 0, bw = slot, hmax = height, minH = 0, zeroH = 0, max,
  hit = false, onSelect, groupClass, pathClass, zeroClass, extra, className, children, ...svgProps }) {
  const top = max ?? Math.max(0, ...items.map((d) => d.value));
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} {...svgProps}>
      {children}
      {items.map((d, i) => {
        const x = x0 + i * slot;
        const h = top > 0 && d.value > 0 ? Math.max(minH, (d.value / top) * hmax) : 0;
        const cls = typeof groupClass === 'function' ? groupClass(d, i) : groupClass;
        return (
          <g key={d.key} className={cls} onClick={onSelect ? () => onSelect(i) : undefined}>
            {d.title && <title>{d.title}</title>}
            {hit && <rect x={x - (slot - bw) / 2} y="0" width={slot} height={height} fill="transparent" />}
            {h > 0 ? <path className={pathClass} d={barPath(x, bw, h, base)} />
              : zeroH > 0 && <rect className={zeroClass} x={x} y={base - zeroH} width={bw} height={zeroH} rx={zeroH / 2} />}
            {extra?.(d, i, { x, y: base - h, h })}
          </g>
        );
      })}
    </svg>
  );
}
