// Czat grupowy (SPO-2): wspólne elementy tras app/api/groups/[id]/messages i reports. Treść szyfrowana jak notatki
// (data-crypto, AAD z id wiadomości). Każda zmiana sprawdza członkostwo w tym samym zapytaniu, więc wyrzucenie z grupy
// i opuszczenie jej odcinają dostęp od razu.
import { sql } from './db';
import { encryptField, readNote, LOCKED_NOTE, NOTE_UNAVAILABLE_REJECT_MSG } from './data-crypto';

export const CHAT_MAX = 2000;
export const EDIT_MINUTES = 15;
export const PAGE = 30; // starsze: strona
export const AFTER_MAX = 50; // nowsze: najwięcej na raz

// Treść po trim (1..CHAT_MAX znaków) albo null. Znacznik LOCKED_NOTE odrzucamy, bo wyglądałby jak „zachowaj”.
export function cleanBody(v) {
  const s = String(v ?? '').trim();
  return s && s.length <= CHAT_MAX && s !== LOCKED_NOTE ? s : null;
}

export const BAD_BODY_MSG = `Wiadomość musi mieć od 1 do ${CHAT_MAX} znaków.`;
export const NOT_FOUND_MSG = 'Nie znaleziono grupy.';
export { NOTE_UNAVAILABLE_REJECT_MSG };

// Aktywny członek grupy: { role } albo undefined (zaproszony bez przyjęcia i obcy wyglądają tak samo)
export async function activeMember(gid, uid) {
  const [m] = await sql()`SELECT role FROM group_members WHERE group_id = ${gid}::int AND user_id = ${uid}::int AND status = 'active'`;
  return m;
}

// Zaszyfrowana treść wiadomości o danym id albo null, gdy konfiguracja szyfrowania uniemożliwia zapis
export function sealBody(id, text) {
  try { return encryptField('group_messages', 'body', String(id), text); } catch { return null; }
}

// Wiadomości widoczne dla `me` (blokada w dowolną stronę ukrywa wiadomości drugiej osoby). `where`: dodatkowy warunek na m
// z parametrami od $3; `tail`: ORDER BY/LIMIT.
export async function fetchMessages(gid, me, where, params, tail) {
  return sql().query(`SELECT m.id, m.user_id, m.body, m.created_at, m.edited_at, m.deleted_at, u.username, u.display_name,
      (u.avatar IS NOT NULL AND can_see($2::int, u.id, u.profile_visibility)) AS has_avatar,
      (m.user_id = $2::int AND m.deleted_at IS NULL AND m.created_at > now() - interval '${EDIT_MINUTES} minutes') AS can_edit
    FROM group_messages m JOIN users u ON u.id = m.user_id
    WHERE m.group_id = $1::int AND can_see($2::int, m.user_id, 'all') AND ${where} ${tail}`, [gid, me, ...params]);
}

// Wiersz z bazy -> obiekt dla klienta. Nieczytelny szyfrogram daje locked: true i pustą treść (klient nie dostaje znacznika).
export function toClient(r, me, myRole, isAdmin) {
  const deleted = !!r.deleted_at;
  const mine = r.user_id === me;
  const { text, locked } = deleted ? { text: '', locked: false } : readNote('group_messages', 'body', String(r.id), r.body);
  return {
    id: r.id, userId: r.user_id, mine, name: r.display_name || r.username, username: r.username, hasAvatar: !!r.has_avatar,
    body: text, locked, deleted, createdAt: r.created_at, editedAt: r.edited_at,
    canEdit: !!r.can_edit && !deleted, canDelete: !deleted && (mine || myRole === 'owner' || !!isAdmin),
  };
}
