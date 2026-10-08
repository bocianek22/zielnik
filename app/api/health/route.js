import { NextResponse } from 'next/server';
import { ensureDb, sql, SCHEMA_HASH } from '@/lib/db';
import { safe } from '@/lib/guard';
import { clientIp, hit } from '@/lib/ratelimit';
import { VERSION } from '@/lib/version';

// Publiczny stan dla monitoringu dostępności (np. UptimeRobot): baza i zgodność schematu, bez danych użytkowników
// i bez treści błędów. Przy niezgodnym schemacie ensureDb() robi tę samą migrację, co pierwsze żądanie po wdrożeniu,
// więc monitoring nie zgłasza fałszywego alarmu po każdym wdrożeniu ze zmianą bazy.
export const dynamic = 'force-dynamic';
const json = (o, status = 200) => NextResponse.json(o, { status, headers: { 'Cache-Control': 'no-store' } });

export const GET = safe(async () => {
  let db = false, schema = 'niezgodny';
  try {
    await ensureDb();
    const [r] = await sql()`SELECT value FROM schema_meta WHERE key = 'schema'`;
    db = true;
    if (r?.value === SCHEMA_HASH) schema = 'zgodny';
  } catch {
    try { await sql()`SELECT 1`; db = true; } catch { /* baza niedostępna */ }
  }
  // limit na IP (monitoring odpytuje co kilka minut): tylko gdy baza działa, bo licznik leży w bazie
  if (db && schema === 'zgodny' && !(await hit(`health:${await clientIp()}`, 120, 600).catch(() => true))) {
    return json({ ok: false, error: 'Zbyt wiele zapytań.' }, 429);
  }
  const ok = db && schema === 'zgodny';
  return json({ ok, db, schema, version: VERSION }, ok ? 200 : 503);
});
