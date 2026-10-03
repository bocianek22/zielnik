// Zamiennik @vercel/blob w testach: obiekty w pamięci, ten sam kształt put/get/del/list co prawdziwa paczka.
// `calls` i `fail` pozwalają testom podglądać wywołania i wymuszać błędy (np. nieudane usunięcie).
export const store = new Map();
export const calls = { put: [], get: [], del: [] };
export const fail = { del: false, put: false };

export async function put(path, body, opts = {}) {
  calls.put.push({ path, opts });
  if (fail.put) throw new Error('put: błąd wymuszony');
  if (store.has(path) && !opts.allowOverwrite) throw new Error('obiekt już istnieje');
  store.set(path, { body: Buffer.from(body), contentType: opts.contentType, access: opts.access });
  return { pathname: path, url: `https://blob.example/${path}` };
}

export async function get(path, opts = {}) {
  calls.get.push({ path, opts });
  const f = store.get(path);
  if (!f) return null;
  return { statusCode: 200, stream: new Blob([f.body]).stream(), blob: { pathname: path, contentType: f.contentType } };
}

export async function del(paths) {
  calls.del.push([].concat(paths));
  if (fail.del) throw new Error('del: błąd wymuszony');
  for (const p of [].concat(paths)) store.delete(p);
}

export async function list({ prefix = '' } = {}) {
  return { blobs: [...store.keys()].filter((p) => p.startsWith(prefix)).map((pathname) => ({ pathname, uploadedAt: new Date() })), hasMore: false };
}
