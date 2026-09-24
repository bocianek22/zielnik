import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';

const list = (me) => sql()`
  SELECT g.id, g.name, g.description, gm.status, gm.role,
         (SELECT count(*)::int FROM group_members m WHERE m.group_id = g.id AND m.status = 'active') AS members
  FROM groups g JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ${me}::int
  ORDER BY (gm.status = 'invited') DESC, lower(g.name)`;

export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ groups: await list(user.id) });
});

// Nowa grupa: { name, description }
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? '').trim().slice(0, 60);
  if (name.length < 3) return bad('Nazwa grupy musi mieć co najmniej 3 znaki.');
  const own = await sql()`SELECT count(*)::int AS n FROM groups WHERE owner_id = ${user.id}`;
  if (own[0].n >= 10) return bad('Możesz być właścicielem maksymalnie 10 grup.');
  const [g] = await sql()`INSERT INTO groups (name, description, owner_id) VALUES (${name}, ${String(b.description ?? '').trim().slice(0, 300)}, ${user.id}) RETURNING id`;
  await sql()`INSERT INTO group_members (group_id, user_id, role, status) VALUES (${g.id}, ${user.id}, 'owner', 'active')`;
  return NextResponse.json({ groups: await list(user.id), id: g.id });
});
