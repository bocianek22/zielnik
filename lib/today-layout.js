import { ensureDb, sql } from './db';
import { parseHidden } from './today-cards';

export async function todayHidden(userId) {
  await ensureDb();
  const [r] = await sql()`SELECT today_hidden FROM users WHERE id = ${userId}::int`;
  return parseHidden(r?.today_hidden);
}

export async function setTodayHidden(userId, hidden) {
  await ensureDb();
  const list = parseHidden(hidden);
  await sql()`UPDATE users SET today_hidden = ${list.join(',')} WHERE id = ${userId}::int`;
  return list;
}
