import { ensureDb, sql } from './db';
import { parseHidden, parseOrder } from './today-cards';

// Układ panelu „Dziś” na koncie: ukryte karty (POM-48) i kolejność (UI 5 etap 3)
export async function todayLayout(userId) {
  await ensureDb();
  const [r] = await sql()`SELECT today_hidden, today_order, display_name FROM users WHERE id = ${userId}::int`;
  // displayName tylko do powitania na „Dziś” (strona główna i tak czyta ten wiersz)
  return { hidden: parseHidden(r?.today_hidden), order: parseOrder(r?.today_order), displayName: r?.display_name || '' };
}

export async function todayHidden(userId) {
  return (await todayLayout(userId)).hidden;
}

// Zapis tylko podanych pól (stary klient wysyła samo `hidden`)
export async function setTodayLayout(userId, { hidden, order } = {}) {
  await ensureDb();
  if (hidden !== undefined) await sql()`UPDATE users SET today_hidden = ${parseHidden(hidden).join(',')} WHERE id = ${userId}::int`;
  if (order !== undefined) await sql()`UPDATE users SET today_order = ${parseOrder(order).join(',')} WHERE id = ${userId}::int`;
  return todayLayout(userId);
}

export async function setTodayHidden(userId, hidden) {
  return (await setTodayLayout(userId, { hidden })).hidden;
}
