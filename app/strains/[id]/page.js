import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { isNativeApp } from '@/lib/client';
import { intId } from '@/lib/ids';
import { listStrains, listOptions, listTests, strainIndex } from '@/lib/strains';
import { strainStats } from '@/lib/strain-stats';
import { strainBatches } from '@/lib/batches';
import { editMode, listMine } from '@/lib/proposals';
import Header from '../../components/Header';
import StrainDetail from '../../components/StrainDetail';

export const dynamic = 'force-dynamic';

export default async function StrainPage({ params }) {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  const id = intId((await params).id);
  if (!id) notFound();
  // pełne wpisy tylko tej odmiany; do puli i podpowiedzi smaków wystarcza lekki spis
  // statystyki zawsze z user.id z sesji: tylko własne zużycia i zakupy
  const [[strain], strains, options, tests, stats, mode, proposals, batches] = await Promise.all([listStrains(user.id, { ids: [id] }), strainIndex(), listOptions(), listTests(id, user.id), strainStats(user.id, id), editMode(user, id), listMine(user.id, id), strainBatches(user.id, id)]);
  if (!strain) notFound();

  const mates = strains.filter((s) => s.id !== id && s.pool_key === strain.pool_key).map((s) => s.name);
  const tastes = [...new Set(strains.map((s) => s.taste).filter(Boolean))];

  return (
    <>
      <Header user={user} />
      <main className="page">
        <StrainDetail strain={strain} options={options} tastes={tastes} mates={mates} tests={tests} stats={stats} batches={batches} proposals={proposals.slice(0, 3)} proposing={mode === 'proposal'}
          me={{ id: user.id, isAdmin: user.is_admin, hidePrices: isNativeApp(await headers()) }} />
      </main>
    </>
  );
}
