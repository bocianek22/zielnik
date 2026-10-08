import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { LEGAL_VERSION } from '@/lib/legal';

// Ponowna akceptacja regulaminu i polityki prywatności po zmianie ich wersji. Oba pola są wymagane (jak przy rejestracji).
// `version` to wersja, którą człowiek widział w arkuszu: gdy dokumenty zmieniły się w międzyczasie, odmowa (409),
// żeby nie zaakceptować tekstu, którego nie zobaczył. Serwer zapisuje własną stałą, nie wartość od klienta.
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  if (b.consent !== true) return bad('Zaakceptuj regulamin i politykę prywatności.');
  if (b.healthConsent !== true) return bad('Wyraź zgodę na przetwarzanie danych o zdrowiu albo usuń konto.');
  if (b.version !== LEGAL_VERSION) return bad('Dokumenty zostały zaktualizowane. Odśwież stronę i przeczytaj je ponownie.', 409);
  await sql()`UPDATE users SET consent_at = now(), consent_version = ${LEGAL_VERSION} WHERE id = ${user.id}`;
  return NextResponse.json({ ok: true, version: LEGAL_VERSION });
});
