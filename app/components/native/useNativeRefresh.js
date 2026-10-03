'use client';
import { useEffect, useRef } from 'react';

// Komponenty trzymające dane w stanie (listy pobierane po stronie przeglądarki) dopisują tu swoje pobranie,
// a gest „przeciągnij, aby odświeżyć” (native/PullRefresh.js) czeka na nie. W przeglądarce zdarzenie nie występuje.
export default function useNativeRefresh(load) {
  const ref = useRef(load);
  useEffect(() => { ref.current = load; });
  useEffect(() => {
    const on = (e) => e.detail?.wait?.push(Promise.resolve().then(() => ref.current()).catch(() => {}));
    window.addEventListener('zielnik:refresh', on);
    return () => window.removeEventListener('zielnik:refresh', on);
  }, []);
}
