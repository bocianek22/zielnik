import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { VIS_VALUES } from '@/lib/visibility';

// Zapis profilu: nazwa wyświetlana, opis, linki, awatar, widoczność profilu
export const PUT = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const links = [];
  for (const raw of Array.isArray(b.links) ? b.links.slice(0, 3) : []) {
    const u = String(raw ?? '').trim();
    if (!u) continue;
    try {
      const url = new URL(u);
      if (!['http:', 'https:'].includes(url.protocol) || u.length > 200) throw new Error();
      links.push(url.toString());
    } catch { return bad('Linki muszą być poprawnymi adresami http(s).'); }
  }
  const vis = VIS_VALUES.includes(b.profileVisibility) ? b.profileVisibility : 'friends';
  await sql()`UPDATE users SET display_name = ${String(b.displayName ?? '').trim().slice(0, 40)},
                bio = ${String(b.bio ?? '').trim().slice(0, 500)}, links = ${JSON.stringify(links)}::jsonb,
                profile_visibility = ${vis} WHERE id = ${user.id}`;
  if (b.avatar === null) await sql()`UPDATE users SET avatar = NULL WHERE id = ${user.id}`;
  else if (typeof b.avatar === 'string') {
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.avatar) || b.avatar.length > 200_000) return bad('Nieprawidłowy awatar.');
    await sql()`UPDATE users SET avatar = ${b.avatar} WHERE id = ${user.id}`;
  }
  return NextResponse.json({ ok: true });
});
