import { NextResponse } from 'next/server';
import { getUser } from './auth';

export const bad = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

// Zwraca { user } albo { res } z gotową odpowiedzią błędu.
export async function requireUser() {
  const user = await getUser();
  if (!user) return { res: bad('Sesja wygasła. Zaloguj się ponownie.', 401) };
  if (user.must_change_password) return { res: bad('Najpierw ustaw nowe hasło.', 403) };
  return { user };
}

// Opakowanie obsługi błędów, żeby klient zawsze dostał JSON.
export const safe = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (e) {
    console.error(e);
    return bad('Błąd serwera. Spróbuj ponownie.', 500);
  }
};
