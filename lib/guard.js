import { NextResponse } from 'next/server';
import { getUser } from './auth';
import { logError } from './errorlog';

export const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

// Identyfikator z adresu (np. /api/strains/abc): błędny daje 0, które nie pasuje do żadnego wiersza (404 zamiast błędu SQL 500).
export const intId = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : 0; };

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
export const safe = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (e) {
    console.error(e);
    let path = null;
    try { path = args[0]?.url ? new URL(args[0].url).pathname : null; } catch {}
    await logError('api', e, { path });
    return bad('Błąd serwera. Spróbuj ponownie.', 500);
  }
};
