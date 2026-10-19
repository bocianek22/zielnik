import { cookies } from 'next/headers';
import { DISCREET_META, ogMeta } from './og';

// Tryb dyskretny (ciasteczko z przełącznika w profilu): neutralny tytuł i żadnych znaczników marki,
// bo systemowy arkusz „Udostępnij” potrafi pokazać og:title i obrazek bieżącej strony.
export async function shareMeta(kind) {
  const discreet = (await cookies()).get('zielnik_discreet')?.value === '1';
  return discreet ? DISCREET_META : ogMeta(kind);
}
