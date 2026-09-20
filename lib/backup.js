import { ensureDb, sql } from './db';

// Zrzut całej bazy do obiektu (bez haseł, awatarów i zdjęć, które są za duże)
export async function buildBackup() {
  await ensureDb();
  const q = sql();
  const rows = async (p) => (await p)[0].rows;
  return {
    createdAt: new Date().toISOString(),
    users: await rows(q`SELECT COALESCE(jsonb_agg(to_jsonb(t) - 'password_hash' - 'avatar'), '[]') AS rows FROM users t`),
    options: await rows(q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM options t`),
    strains: await rows(q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM strains t`),
    user_strain: await rows(q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM user_strain t`),
    user_pool: await rows(q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM user_pool t`),
    purchases: await rows(q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM purchases t`),
    usage_log: await rows(q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM usage_log t`),
    strain_tests: await rows(q`SELECT COALESCE(jsonb_agg(to_jsonb(t) - 'data'), '[]') AS rows FROM strain_tests t`),
    friendships: await rows(q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM friendships t`),
    groups: await rows(q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM groups t`),
    group_members: await rows(q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM group_members t`),
    blocks: await rows(q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM blocks t`),
    market_catalog: await rows(q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM market_catalog t`),
  };
}

// Zapisuje migawkę w bazie (kind: 'auto' | 'ręczna') i zostawia 8 najnowszych
export async function saveSnapshot(kind) {
  const json = JSON.stringify(await buildBackup());
  await sql()`INSERT INTO backups (kind, size, data) VALUES (${kind}, ${json.length}, ${json})`;
  await sql()`DELETE FROM backups WHERE id NOT IN (SELECT id FROM backups ORDER BY created_at DESC, id DESC LIMIT 8)`;
  return json.length;
}
