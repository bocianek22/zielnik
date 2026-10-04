// Next.js wywołuje to przy każdym nieobsłużonym błędzie serwera (strony i trasy API).
// Import wewnątrz warunku na NEXT_RUNTIME: tylko tak paczka Edge (middleware.js) nie dociąga lib/db.js (node:crypto).
export async function onRequestError(err, request, context) {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logError } = await import('./lib/errorlog.js');
    await logError(context?.routeType || 'serwer', err, { path: request?.path, digest: err?.digest });
  }
}
