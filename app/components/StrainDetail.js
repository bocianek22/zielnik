'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OwnEntry, OtherEntry } from './StrainCard';
import StrainForm from './StrainForm';
import Tests from './Tests';
import Effects from './Effects';
import CharacteristicCard from './CharacteristicCard';
import { expiryInfo } from '@/lib/expiry';

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
    <div className="stack">
      <Link href="/" className="back">← Wszystkie odmiany</Link>

      {editing ? (
        <StrainForm strain={strain} options={opts} tastes={tastes} canDelete={canDelete} onOptionsChange={setOpts}
          onDone={() => { setEditing(false); router.refresh(); }} onDeleted={() => router.push('/')}
          onCancel={() => setEditing(false)} />
      ) : (
        <article className={`card strain detail k-${strain.kind || 'none'}`}>
          <div className="detail-top">
            {strain.photo_v && (
              <a href={photo} target="_blank" rel="noreferrer"><img className="detail-photo" src={photo} alt={`Zdjęcie: ${strain.name}`} /></a>
            )}
            <div className="strain-title">
              <h1>{strain.name}</h1>
              <p className="strain-meta">
                <span>{strain.producer}</span>
                {strain.kind && <span className={`badge kind-${strain.kind}`}>{strain.kind}</span>}
                <span className="badge">{strain.type}</span>
              </p>
              <p className="strain-meta">
                {strain.thc != null && <span className="pill">THC {strain.thc}%</span>}
                {strain.cbd != null && <span className="pill">CBD {strain.cbd}%</span>}
                {strain.final_rating != null && <span className="pill">Ocena końcowa {strain.final_rating}</span>}
                {strain.price_per_g != null && <span className="pill">{strain.price_per_g} zł/g</span>}
                {ex?.expired && <span className="badge low">Po terminie</span>}
                {ex?.soon && <span className="badge low">Ważne jeszcze {ex.days} dni</span>}
              </p>
              {(strain.batch || strain.expires_on) && <p><b>Partia:</b> {strain.batch && <>seria {strain.batch}; </>}{strain.expires_on && <>ważne do {strain.expires_on}</>}</p>}
              {strain.taste && <p><b>Smak:</b> {strain.taste}</p>}
              {strain.terpenes?.length > 0 && (
                <>
                  <p className="label">Profil terpenowy</p>
                  <div className="chips small">{strain.terpenes.map((t) => <Link key={t} href={`/wiedza#t-${t.toLowerCase().split(' ')[0]}`} className="chip on static">{t}</Link>)}</div>
                </>
              )}
              <button className="btn ghost small" onClick={() => setEditing(true)}>Edytuj odmianę</button>
            </div>
          </div>
        </article>
      )}

      <CharacteristicCard strain={strain} />

      <section className="card">
        <h2>Stany i oceny</h2>
        <div className="entries">
          {mine && <OwnEntry strainId={strain.id} entry={mine} mates={mates} onSaved={() => {}} />}
          {others.map((e) => <OtherEntry key={e.userId} e={e} />)}
        </div>
      </section>

      <Effects strain={strain} meId={me.id} />

      <Tests strainId={strain.id} initialTests={tests} me={me} />
    </div>
  );
}
