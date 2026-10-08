// Zamiennik `next/cache` do testów: unstable_cache trzyma wynik w pamięci procesu (klucz = keyParts + argumenty),
// revalidateTag czyści wpisy z danym tagiem. Wystarcza, by sprawdzić, co trafia do pamięci podręcznej i kiedy jest unieważniane.
const store = new Map();
export const stats = { hits: 0, misses: 0 };

export function unstable_cache(fn, keyParts = [], { tags = [] } = {}) {
  return async (...args) => {
    const key = JSON.stringify([keyParts, args]);
    if (store.has(key)) { stats.hits++; return JSON.parse(store.get(key).json); }
    stats.misses++;
    const value = await fn(...args);
    store.set(key, { json: JSON.stringify(value), tags });
    return value;
  };
}

export function revalidateTag(tag) {
  for (const [k, v] of store) if (v.tags.includes(tag)) store.delete(k);
}
