'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OwnEntry, OtherEntry, dec } from './StrainCard';
import Icon from './Icon';
import StrainForm from './StrainForm';
import Tests from './Tests';
import dynamicImport from 'next/dynamic';
const Effects = dynamicImport(() => import('./Effects'), { loading: () => <div className="card"><p className="muted">Wczytuję skalę odczuć…</p></div> });
import CharacteristicCard from './CharacteristicCard';
import Lightbox from './Lightbox';
import StrainHistory from './StrainHistory';
import { expiryInfo } from '@/lib/expiry';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function StrainDetail({ strain, options, tastes, mates, tests, me }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [opts, setOpts] = useState(options);
  const mine = strain.entries.find((e) => e.userId === me.id);
  const others = strain.entries.filter((e) => e.userId !== me.id);
  const photo = `/api/strains/${strain.id}/photo?v=${strain.photo_v}`;
  const ex = expiryInfo(strain.expires_on);
  const canDelete = me.isAdmin || strain.created_by === me.id;

  return (
    <div className="stack detail-page">
      <Link href="/" className="back"><Icon name="chevronLeft" size={20} />Wszystkie odmiany</Link>

      {editing ? (
        <StrainForm strain={strain} options={opts} tastes={tastes} canDelete={canDelete} hidePrice={me.hidePrices} onOptionsChange={setOpts}
          onDone={() => { setEditing(false); router.refresh(); }} onDeleted={() => router.push('/')}
          onCancel={() => setEditing(false)} />
      ) : (
        <article className={`card strain detail k-${strain.kind || 'none'}`}>
          <div className="detail-top">
            {strain.photo_v && (
              <Lightbox className="detail-photo dn-img" src={photo} alt={`Zdjęcie: ${strain.name}`} />
            )}
            <div className="strain-title">
              <h1 className="dn">{strain.name}</h1>
              <p className="strain-meta">
                <span className="dn">{strain.producer}</span>
                {strain.kind && <span className={`kind kind-${strain.kind}`}><i className="kind-dot" aria-hidden="true" />{cap(strain.kind)}</span>}
                <span>{cap(strain.type)}</span>
              </p>
              {(ex?.expired || ex?.soon) && (
                <p className="strain-status">
                  {ex?.expired && <span className="badge low">Po terminie</span>}
                  {ex?.soon && <span className="badge low">Ważne jeszcze {ex.days} dni</span>}
                </p>
              )}
              <dl className="facts detail-facts">
                {strain.final_rating != null && <div><dt>Ocena końcowa</dt><dd>{dec(strain.final_rating)}</dd></div>}
                {strain.thc != null && <div><dt>THC</dt><dd>{dec(strain.thc)}%</dd></div>}
                {strain.cbd != null && <div><dt>CBD</dt><dd>{dec(strain.cbd)}%</dd></div>}
                {strain.price_per_g != null && !me.hidePrices && <div><dt>Cena</dt><dd>{dec(strain.price_per_g)} zł/g</dd></div>}
                {strain.batch && <div><dt>Seria</dt><dd>{strain.batch}</dd></div>}
                {strain.expires_on && <div><dt>Ważne do</dt><dd>{strain.expires_on}</dd></div>}
                {strain.taste && <div><dt>Smak</dt><dd>{strain.taste}</dd></div>}
              </dl>
              {strain.terpenes?.length > 0 && (
                <>
                  <p className="label">Profil terpenowy</p>
                  <div className="chips small">{strain.terpenes.map((t) => <Link key={t} href={`/wiedza#t-${t.toLowerCase().split(' ')[0]}`} className="chip on static dn">{t}</Link>)}</div>
                </>
              )}
              <div className="detail-actions">
                <button className="btn ghost" onClick={() => setEditing(true)}><Icon name="edit" size={18} />Edytuj odmianę</button>
              </div>
            </div>
          </div>
        </article>
      )}

      <CharacteristicCard strain={strain} hidePrice={me.hidePrices} />

      <section className="card">
        <h2>Stany i oceny</h2>
        <div className="entries">
          {mine && <OwnEntry strainId={strain.id} entry={mine} mates={mates} hidePrice={me.hidePrices} onSaved={() => {}} />}
          {others.map((e) => <OtherEntry key={e.userId} e={e} />)}
        </div>
      </section>

      <Effects strain={strain} meId={me.id} />

      <Tests strainId={strain.id} initialTests={tests} me={me} />

      <StrainHistory strainId={strain.id} isAdmin={me.isAdmin} hidePrice={me.hidePrices} />
    </div>
  );
}
