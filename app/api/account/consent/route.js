import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, jsonBody } from '@/lib/guard';
import { legalContactReady, legalVersion } from '@/lib/legal';

// Ponowna akceptacja regulaminu i polityki prywatności po zmianie ich wersji. Oba pola są wymagane (jak przy rejestracji).
// `version` to wersja, którą człowiek widział w arkuszu: gdy dokumenty zmieniły się w międzyczasie (także kontakt
// administratora), odmowa (409), żeby nie zaakceptować tekstu, którego nie zobaczył. Serwer zapisuje własną wersję, nie wartość
// od klienta. Dokument bez kontaktu administratora jest niekompletny: nikt go nie akceptuje (409).
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await jsonBody(req);
  if (b.consent !== true) return bad('Zaakceptuj regulamin i politykę prywatności.');
  if (b.healthConsent !== true) return bad('Wyraź zgodę na przetwarzanie danych o zdrowiu albo usuń konto.');
  if (!legalContactReady()) return bad('Dokumenty są w przygotowaniu (brak danych administratora). Spróbuj później.', 409);
  const version = legalVersion();
  if (b.version !== version) return bad('Dokumenty zostały zaktualizowane. Odśwież stronę i przeczytaj je ponownie.', 409);
  // stan bieżący (users) i historia (consent_log) w jednej instrukcji
  await sql()`WITH u AS (UPDATE users SET consent_at = now(), consent_version = ${version} WHERE id = ${user.id} RETURNING id)
              INSERT INTO consent_log (user_id, version, terms, health) SELECT id, ${version}, TRUE, TRUE FROM u`;
  return NextResponse.json({ ok: true, version });
});
