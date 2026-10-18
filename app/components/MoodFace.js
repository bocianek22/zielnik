// UI 5 etap 4: buźka przy suwaku objawu, zmienia się przy przesuwaniu. Tylko przy wpisie (nie na wykresach: tam kolor nie ocenia).
// Kierunek zależy od objawu: ból i lęk niżej = lepiej, sen i nastrój wyżej = lepiej (higherBetter). Dekoracja: aria-hidden,
// wartość czyta suwak. Bez emoji systemowych (każdy telefon rysuje je inaczej), własne SVG w kolorach motywu.
import { faceLevel } from '@/lib/mood-face';

// usta: łuk od smutnego (ujemne wygięcie) do uśmiechu; brwi tylko przy złym samopoczuciu
const MOUTH = ['M12 25 Q18 19 24 25', 'M12 24 Q18 21 24 24', 'M12 23 L24 23', 'M12 22 Q18 26 24 22', 'M11 21 Q18 29 25 21'];

export default function MoodFace({ value, higherBetter, size = 36 }) {
  const lvl = faceLevel(value, higherBetter);
  return (
    <svg className="mood-face" data-level={lvl ?? 'none'} width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <circle cx="18" cy="18" r="16.5" className="mf-bg" />
      {lvl == null ? (
        <path d="M12 23 L24 23" className="mf-line" />
      ) : (
        <>
          {lvl === 0 && <path d="M10.5 13 L15 11 M25.5 13 L21 11" className="mf-line" />}
          <circle cx="13" cy="15.5" r="1.9" className="mf-eye" />
          <circle cx="23" cy="15.5" r="1.9" className="mf-eye" />
          <path d={MOUTH[lvl]} className="mf-line" />
        </>
      )}
    </svg>
  );
}
