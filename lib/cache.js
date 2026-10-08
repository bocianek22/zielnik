import { unstable_cache, revalidateTag } from 'next/cache';

// Pamięć podręczna WYŁĄCZNIE dla danych wspólnych i niezdrowotnych (katalog odmian: nazwa, producent, smak; opcje).
// Nigdy nie opakowuj tu funkcji, która dostaje id użytkownika albo zwraca wpisy, oceny, stany i notatki.
// Poza środowiskiem Next (testy, skrypty) unstable_cache rzuca wyjątkiem, więc wtedy liczymy bez pamięci podręcznej.
export const STRAIN_TAG = 'strains';
const TTL = 60; // s; tag unieważniamy przy edycji, czas jest tylko zabezpieczeniem

export function sharedCache(fn, keyParts, { tags = [STRAIN_TAG], revalidate = TTL } = {}) {
  let cached;
  try { cached = unstable_cache(fn, keyParts, { tags, revalidate }); } catch { return fn; }
  return async (...args) => {
    try { return await cached(...args); } catch (e) {
      if (/incrementalCache|static generation store/i.test(String(e?.message))) return fn(...args);
      throw e;
    }
  };
}

// Po zmianie odmiany albo opcji; bez kontekstu Next (testy) nic nie robi.
export function invalidateStrains() {
  try { revalidateTag(STRAIN_TAG); } catch { /* poza Next */ }
}
