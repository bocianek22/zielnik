import { NextResponse } from 'next/server';
import { getUser } from './auth';
import { logError } from './errorlog';

export const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

export { intId } from './ids';

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

// Opakowanie obsługi błędów, żeby klient zawsze dostał JSON.
// Odpowiedzi API (dane zdrowotne, eksport) domyślnie z `Cache-Control: no-store`: nie zostają w pamięci przeglądarki ani
// pośredników po wylogowaniu. Trasy, które same ustawiają cache (zdjęcia: `private`), zachowują swój nagłówek.
export const safe = (fn) => async (...args) => {
  try {
    return noStore(await fn(...args));
  } catch (e) {
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
