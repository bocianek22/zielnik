'use client';
import { useEffect, useRef, useState } from 'react';
import useFocusTrap from './useFocusTrap';

// Podpis atrybucji zdjęcia z wolnej licencji: „Fot. Autor, licencja” (licencja jako link, gdy znamy adres)
export function PhotoCredit({ attr, className = 'photo-credit' }) {
  if (!attr?.credit) return null;
  const lic = attr.licenseUrl ? <a href={attr.licenseUrl} target="_blank" rel="noopener noreferrer">{attr.license}</a> : attr.license;
  return (
    <p className={className} onClick={(e) => e.stopPropagation()}>
      Fot. {attr.credit}{attr.license && <>, {lic}</>}
      {attr.sourceUrl && <> (<a href={attr.sourceUrl} target="_blank" rel="noopener noreferrer">źródło</a>)</>}
    </p>
  );
}

// Klikalne zdjęcie, które po dotknięciu otwiera się na cały ekran z widocznym przyciskiem zamknięcia
// fallback: co pokazać, gdy zdjęcie się nie wczytało (uszkodzony plik, brak sieci); bez niego zostaje zwykły obraz
export default function Lightbox({ src, alt, className, attr, fallback = null }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const box = useRef(null);
  const img = useRef(null);
  // błąd mógł wystąpić przed hydratacją (onError się nie wykona): sprawdzamy stan obrazu po montażu
  useEffect(() => {
    const el = img.current;
    setFailed(!!el && el.complete && el.naturalWidth === 0);
  }, [src]);
  useFocusTrap(box, open, () => setOpen(false));
  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (failed && fallback) return fallback;
  return (
    <>
      <button type="button" className="photo-open" onClick={() => setOpen(true)} aria-label={`Powiększ: ${alt}`}>
        <img ref={img} className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      </button>
      {open && (
        <div className="lightbox" ref={box} role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)}>
          <button type="button" className="lightbox-close" onClick={() => setOpen(false)} aria-label="Zamknij podgląd">×</button>
          <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
          <PhotoCredit attr={attr} className="lightbox-credit" />
        </div>
      )}
    </>
  );
}
