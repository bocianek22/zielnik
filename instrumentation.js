// Next.js wywołuje to przy każdym nieobsłużonym błędzie serwera (strony i trasy API)
export async function onRequestError(err, request, context) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { logError } = await import('./lib/errorlog.js');
  await logError(context?.routeType || 'serwer', err, { path: request?.path, digest: err?.digest });
}
