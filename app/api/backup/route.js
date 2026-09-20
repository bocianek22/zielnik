import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';

// Kopia zapasowa całej bazy do pliku JSON (tylko admin). Bez haseł i bez zdjęć (za duże).
export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!user.is_admin) return bad('Tylko admin może pobrać kopię zapasową.', 403);
  const q = sql();
  const dump = async (rows) => rows[0].rows;
  const data = {
    createdAt: new Date().toISOString(),
    users: await dump(await q`SELECT COALESCE(jsonb_agg(to_jsonb(t) - 'password_hash'), '[]') AS rows FROM users t`),
    options: await dump(await q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM options t`),
    strains: await dump(await q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM strains t`),
    user_strain: await dump(await q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM user_strain t`),
    user_pool: await dump(await q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM user_pool t`),
    purchases: await dump(await q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM purchases t`),
    usage_log: await dump(await q`SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]') AS rows FROM usage_log t`),
    strain_tests: await dump(await q`SELECT COALESCE(jsonb_agg(to_jsonb(t) - 'data'), '[]') AS rows FROM strain_tests t`),
  };
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 1), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="zielnik-kopia-${day}.json"` },
  });
});
