// Zamiennik next/headers: ciasteczka w pamięci (jedna "przeglądarka" naraz) i adres IP klienta (domyślnie stały, testy mogą go zmienić).
// `ua`, `country` (x-vercel-ip-country) i `host` są opcjonalne: bez nich nagłówków nie ma, jak w starszych testach.
export const jar = new Map();
export const client = { ip: '127.0.0.1', ua: null, country: null, host: null };

export async function cookies() {
  return { get: (k) => (jar.has(k) ? { value: jar.get(k) } : undefined), set: (k, v) => jar.set(k, v), delete: (k) => jar.delete(k) };
}

export async function headers() {
  const h = new Map([['x-forwarded-for', client.ip]]);
  if (client.ua) h.set('user-agent', client.ua);
  if (client.country) h.set('x-vercel-ip-country', client.country);
  if (client.host) h.set('host', client.host);
  return h;
}
