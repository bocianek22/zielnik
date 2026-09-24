import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { listStrains } from '@/lib/strains';
import { listCatalog } from '@/lib/catalog';
import Header from '../components/Header';
import CatalogBoard from './CatalogBoard';

export const dynamic = 'force-dynamic';

export default async function Katalog() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const [items, strains] = await Promise.all([listCatalog(), listStrains(user.id)]);
  const owned = strains.map((s) => `${s.producer}|${s.name}`.toLowerCase());
  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Katalog odmian w Polsce</h1>
        <CatalogBoard items={items} owned={owned} isAdmin={user.is_admin} />
      </main>
    </>
  );
}
