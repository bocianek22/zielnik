import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { strainIndex } from '@/lib/strains';
import { listCatalog } from '@/lib/catalog';
import Header from '../components/Header';
import CatalogBoard from './CatalogBoard';
import StrainsNav from '../odmiany/StrainsNav';
import PageHero from '../components/PageHero';

export const dynamic = 'force-dynamic';

export default async function Katalog() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const [items, strains] = await Promise.all([listCatalog(), strainIndex()]);
  const owned = strains.map((s) => `${s.producer}|${s.name}`.toLowerCase());
  return (
    <>
      <Header user={user} />
      <main className="page">
        <PageHero cat="strain" icon="book" title="Katalog odmian" sub="Odmiany dostępne w Polsce" />
        <StrainsNav current="katalog" />
        <CatalogBoard items={items} owned={owned} isAdmin={user.is_admin} />
      </main>
    </>
  );
}
