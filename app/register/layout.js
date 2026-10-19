import { shareMeta } from '@/lib/share-meta';

// Podgląd linku z zaproszeniem (/register?code=…): strona jest komponentem klienckim, więc metadane są tutaj.
// Kod zaproszenia nie trafia do tytułu, opisu ani obrazka.
export const generateMetadata = () => shareMeta('invite');

export default function RegisterLayout({ children }) {
  return children;
}
