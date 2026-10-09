import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { getUser } from './auth';
import { logError } from './errorlog';

export const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

export { intId } from './ids';

// Błąd „z góry znany” (np. zły JSON): safe() zamienia go na odpowiedź bez wpisu w dzienniku błędów i bez kodu 500.
export class HttpError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Treść żądania jako zwykły obiekt. Pusta treść daje {} (zgodnie z dotychczasowym `.catch(() => ({}))`), a zepsuty JSON
// albo wartość inna niż obiekt (null, tablica, liczba) daje 400 zamiast TypeError i 500 przy destrukturyzacji.
// maxBytes (opcjonalnie): większa treść daje 413 (nagłówek Content-Length sprawdzamy przed czytaniem, długość tekstu po).
export async function jsonBody(req, maxBytes = 0) {
  if (maxBytes && Number(req.headers.get('content-length')) > maxBytes) throw new HttpError('Plik jest za duży.', 413);
  let text;
  try { text = await req.text(); } catch { throw new HttpError('Nieprawidłowe dane żądania.'); }
  if (maxBytes && text.length > maxBytes) throw new HttpError('Plik jest za duży.', 413);
  if (!text.trim()) return {};
  let v;
  try { v = JSON.parse(text); } catch { throw new HttpError('Nieprawidłowe dane żądania (oczekiwano JSON).'); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new HttpError('Nieprawidłowe dane żądania (oczekiwano obiektu JSON).');
  return v;
}

// Zwraca { user } albo { res } z gotową odpowiedzią błędu.
export async function requireUser() {
  const user = await getUser();
  if (!user) return { res: bad('Sesja wygasła. Zaloguj się ponownie.', 401) };
  if (user.must_change_password) return { res: bad('Najpierw ustaw nowe hasło.', 403) };
  return { user };
}

// Jak requireUser (więc wymuszona zmiana hasła też blokuje), a do tego tylko admin.
export async function requireAdmin(msg = 'Tylko admin.') {
  const r = await requireUser();
  if (r.res) return r;
  if (!r.user.is_admin) return { res: bad(msg, 403) };
  return r;
}

// Zadania cykliczne (Vercel Cron): `Authorization: Bearer <CRON_SECRET>`, porównanie w stałym czasie (skróty SHA-256
// mają równą długość, więc długość sekretu też nie wycieka). Bez ustawionego sekretu zawsze odmowa.
export function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = (s) => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(h(req.headers.get('authorization') || ''), h(`Bearer ${secret}`));
}

// Opakowanie obsługi błędów, żeby klient zawsze dostał JSON.
// Odpowiedzi API (dane zdrowotne, eksport) domyślnie z `Cache-Control: no-store`: nie zostają w pamięci przeglądarki ani
// pośredników po wylogowaniu. Trasy, które same ustawiają cache (zdjęcia: `private`), zachowują swój nagłówek.
export const safe = (fn) => async (...args) => {
  try {
    return noStore(await fn(...args));
  } catch (e) {
    if (e instanceof HttpError) return noStore(bad(e.message, e.status));
    console.error(e);
    let path = null;
    try { path = args[0]?.url ? new URL(args[0].url).pathname : null; } catch {}
    await logError('api', e, { path });
    return noStore(bad('Błąd serwera. Spróbuj ponownie.', 500));
  }
};

function noStore(res) {
  if (res?.headers && !res.headers.has('cache-control')) {
    try { res.headers.set('Cache-Control', 'no-store'); } catch { /* niezmienne nagłówki: zostawiamy */ }
  }
  return res;
}
