'use client';
import { useEffect, useState } from 'react';

// Klikalne zdjęcie, które po dotknięciu otwiera się na cały ekran z widocznym przyciskiem zamknięcia
export default function Lightbox({ src, alt, className }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <button type="button" className="photo-open" onClick={() => setOpen(true)} aria-label={`Powiększ: ${alt}`}>
        <img className={className} src={src} alt={alt} loading="lazy" />
      </button>
      {open && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)}>
          <button type="button" className="lightbox-close" onClick={() => setOpen(false)} aria-label="Zamknij podgląd">×</button>
          <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
