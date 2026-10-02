import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { listStrains, listOptions, listTests, strainIndex } from '@/lib/strains';
import Header from '../../components/Header';
import StrainDetail from '../../components/StrainDetail';

export const dynamic = 'force-dynamic';

export default async function StrainPage({ params }) {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  // pełne wpisy tylko tej odmiany; do puli i podpowiedzi smaków wystarcza lekki spis
  const [[strain], strains, options, tests] = await Promise.all([listStrains(user.id, { ids: [id] }), strainIndex(), listOptions(), listTests(id, user.id)]);
  if (!strain) notFound();

  const mates = strains.filter((s) => s.id !== id && s.pool_key === strain.pool_key).map((s) => s.name);
  const tastes = [...new Set(strains.map((s) => s.taste).filter(Boolean))];

  return (
    <>
      <Header user={user} />
      <main className="page">
        <StrainDetail strain={strain} options={options} tastes={tastes} mates={mates} tests={tests}
          me={{ id: user.id, isAdmin: user.is_admin }} />
      </main>
    </>
  );
}
