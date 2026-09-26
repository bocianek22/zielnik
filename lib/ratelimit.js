import { headers } from 'next/headers';
import { ensureDb, sql } from './db';

export async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
}

// Licznik prób w oknie czasowym. Zwraca true, jeśli limit nie został przekroczony.
export async function hit(key, max, windowSec) {
  await ensureDb();
  const [r] = await sql()`INSERT INTO rate_limits (key, n, reset_at) VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}::int))
    ON CONFLICT (key) DO UPDATE SET
      n = CASE WHEN rate_limits.reset_at < now() THEN 1 ELSE rate_limits.n + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at < now() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
    RETURNING n`;
  if (Math.random() < 0.02) await sql()`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 day'`;
  return r.n <= max;
}

export async function clear(key) {
  await sql()`DELETE FROM rate_limits WHERE key = ${key}`;
}
