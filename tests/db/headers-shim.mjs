// Zamiennik next/headers: ciasteczka w pamięci (jedna "przeglądarka" naraz) i stały adres IP.
export const jar = new Map();

export async function cookies() {
  return { get: (k) => (jar.has(k) ? { value: jar.get(k) } : undefined), set: (k, v) => jar.set(k, v), delete: (k) => jar.delete(k) };
}

export async function headers() {
  return new Map([['x-forwarded-for', '127.0.0.1']]);
}
