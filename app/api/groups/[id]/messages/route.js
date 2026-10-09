import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId, jsonBody } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { activeMember, cleanBody, fetchMessages, toClient, sealBody, BAD_BODY_MSG, NOT_FOUND_MSG, NOTE_UNAVAILABLE_REJECT_MSG, PAGE, AFTER_MAX } from '@/lib/chat';

const MAX_ID = 2147483647;

// ?after=<id>: nowsze od id (rosnąco, do 50); ?before=<id> albo bez parametrów: strona 30 starszych (najnowsza, gdy brak before).
// Odpowiedź: { messages (rosnąco), hasMore } - hasMore tylko dla before/najnowszej strony.
export const GET = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const gid = intId((await params).id);
  const m = gid && await activeMember(gid, user.id);
  if (!m) return bad(NOT_FOUND_MSG, 404);
  const sp = new URL(req.url).searchParams;
  const after = intId(sp.get('after'));
  let rows, hasMore = false;
  if (after) {
    rows = await fetchMessages(gid, user.id, 'm.id > $3::int', [after], `ORDER BY m.id LIMIT ${AFTER_MAX}`);
  } else {
    const before = intId(sp.get('before')) || MAX_ID;
    rows = await fetchMessages(gid, user.id, 'm.id < $3::int', [before], `ORDER BY m.id DESC LIMIT ${PAGE + 1}`);
    hasMore = rows.length > PAGE;
    rows = rows.slice(0, PAGE).reverse();
  }
  return NextResponse.json({ messages: rows.map((r) => toClient(r, user.id, m.role, user.is_admin)), hasMore });
});

// { body } - nowa wiadomość (1..2000 znaków po trim); limity: 20 na minutę i 300 na godzinę na użytkownika
export const POST = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const gid = intId((await params).id);
  const m = gid && await activeMember(gid, user.id);
  if (!m) return bad(NOT_FOUND_MSG, 404);
  const text = cleanBody((await jsonBody(req)).body);
  if (!text) return bad(BAD_BODY_MSG);
  if (!(await hit(`chat:${user.id}:min`, 20, 60)) || !(await hit(`chat:${user.id}:h`, 300, 3600))) {
    return bad('Zbyt wiele wiadomości. Spróbuj ponownie za chwilę.', 429);
  }
  // id jest częścią AAD szyfrogramu, więc rezerwujemy je przed zapisem (jeden INSERT, bez wiersza „w połowie”)
  const [{ id }] = await sql()`SELECT nextval(pg_get_serial_sequence('group_messages', 'id'))::int AS id`;
  const stored = sealBody(id, text);
  if (stored == null) return bad(NOTE_UNAVAILABLE_REJECT_MSG, 422);
  // członkostwo sprawdzone jeszcze raz w samym zapisie: wyrzucony między sprawdzeniem a zapisem nic nie wyśle
  const ins = await sql()`INSERT INTO group_messages (id, group_id, user_id, body)
    SELECT ${id}::int, ${gid}::int, ${user.id}::int, ${stored}::text
    WHERE EXISTS (SELECT 1 FROM group_members WHERE group_id = ${gid}::int AND user_id = ${user.id}::int AND status = 'active')
    RETURNING id`;
  if (!ins.length) return bad(NOT_FOUND_MSG, 404);
  const [row] = await fetchMessages(gid, user.id, 'm.id = $3::int', [id], '');
  return NextResponse.json({ message: toClient(row, user.id, m.role, user.is_admin) });
});
