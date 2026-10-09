'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OwnEntry, dec } from './StrainCard';
import Icon from './Icon';
import SecHead from './SecHead';
import StrainForm from './StrainForm';
import Tests from './Tests';
import ReportButton from './ReportButton';
// zwykły import: fragment ma ~3,5 KB, a leniwe ładowanie (next/dynamic) dokładało podgląd <link rel=preload> bez nonce,
// który CSP strict-dynamic blokował (błąd w konsoli przy pełnym ładowaniu strony odmiany)
import Effects from './Effects';
import CharacteristicCard from './CharacteristicCard';
import PharmacyLink from './PharmacyLink';
import Lightbox, { PhotoCredit } from './Lightbox';
import StrainHistory from './StrainHistory';
import StrainProposals from './StrainProposals';
import UsageWeeks from './charts/UsageWeeks';
import { expiryInfo } from '@/lib/expiry';
import { formLabel } from '@/lib/forms';
import { formatDay } from '@/lib/date';
import { unitOf } from '@/lib/units';
import { revertOf } from '@/lib/offline-queue';
import { hasQueued, wasOptimistic } from '@/lib/offline-client';
import useQueueEvents from './useQueueEvents';

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const num = (n, d = 2) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: d });
// polska odmiana liczebnika: 1 ocena, 2 oceny, 5 ocen
const plural = (n, one, few, many) => (n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many);
const METER_MAX = 30; // jedna skala dla THC i CBD, żeby paski dało się porównać

// ilustracja zamiast pustego prostokąta, gdy odmiana nie ma zdjęcia: słoik z szyszkami albo butelka (olej, pen); tylko dekoracja
function Jar({ drop }) {
  return (
    <svg className="dhero-art" viewBox="0 0 120 140" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {drop ? (
        <>
          <path d="M48 12h24M52 12v14M68 12v14" /><path d="M40 40a8 8 0 0 1 8-8h24a8 8 0 0 1 8 8v78a10 10 0 0 1-10 10H50a10 10 0 0 1-10-10z" />
          <path d="M40 66h40M40 100h40" /><path d="M60 74c6 8 9 12 9 17a9 9 0 0 1-18 0c0-5 3-9 9-17z" />
        </>
      ) : (
        <>
          <path d="M34 14h52M32 28h56" /><path d="M32 28v84a14 14 0 0 0 14 14h28a14 14 0 0 0 14-14V28" />
          <path d="M44 64h32M44 82h32" /><circle cx="52" cy="104" r="6" /><circle cx="68" cy="106" r="5" /><circle cx="60" cy="95" r="5" />
        </>
      )}
    </svg>
  );
}

function Score({ label, value, sub, solid }) {
  return (
    <div className={`kpi-tile${solid ? ' solid' : ''}`} data-cat="strain">
      <dt className="kt-label">{label}</dt>
      <dd className="kt-value">{value == null ? '–' : dec(Number(value).toFixed(1))}{value != null && <small>/10</small>}</dd>
      <dd className="kt-sub">{sub || '\u00a0'}</dd>
    </div>
  );
}

function Meter({ label, value }) {
  const pct = Math.min(100, Math.max(0, (Number(value) / METER_MAX) * 100));
  return (
    <div className="meter-row">
      <span className="meter-lbl" id={`m-${label}`}>{label}</span>
      <div className="meter" role="meter" aria-labelledby={`m-${label}`} aria-valuemin={0} aria-valuemax={METER_MAX}
        aria-valuenow={Number(value)} aria-valuetext={`${dec(value)}%`}>
        <i className={`meter-fill meter-${label.toLowerCase()}`} style={{ width: `${pct}%` }} />
      </div>
      <b className="meter-val">{dec(value)}%</b>
    </div>
  );
}

function lastUseText(s) {
  if (s.lastDaysAgo == null) return ['–', 'brak zużyć'];
  if (s.lastDaysAgo === 0) return ['Dziś', formatDay(s.lastUse)];
  if (s.lastDaysAgo === 1) return ['Wczoraj', formatDay(s.lastUse)];
  if (s.lastDaysAgo < 7) return [`${s.lastDaysAgo} dni temu`, formatDay(s.lastUse)];
  return [formatDay(s.lastUse).replace(/ \d{4}$/, ''), `${s.lastDaysAgo} dni temu`];
}

function MyStats({ stats, unit }) {
  const empty = !stats.uses && !stats.purchases;
  const [last, lastSub] = lastUseText(stats);
  return (
    <section className="card mystats" aria-labelledby="mystats-h">
      <SecHead cat="journal" icon="chart" id="mystats-h">Moje statystyki</SecHead>
      {empty ? (
        <p className="muted">Nie masz jeszcze zapisanych zużyć ani zakupów tej odmiany. Zapiszesz je niżej, w sekcji „Mój wpis”.</p>
      ) : (
        <>
          <dl className="mystats-grid">
            <div><dt>Wykupione</dt><dd><b>{num(stats.bought)}</b> {unit}</dd><dd className="sub">{stats.purchases} {plural(stats.purchases, 'zakup', 'zakupy', 'zakupów')}</dd></div>
            <div><dt>Zużyte</dt><dd><b>{num(stats.used)}</b> {unit}</dd><dd className="sub">{stats.uses} {plural(stats.uses, 'raz', 'razy', 'razy')}</dd></div>
            <div><dt>Średnio dziennie</dt><dd><b>{stats.perDay == null ? '–' : num(stats.perDay)}</b>{stats.perDay != null && ` ${unit}`}</dd><dd className="sub">w ostatnich 12 tyg.</dd></div>
            <div><dt>Ostatnie użycie</dt><dd><b className="txt">{last}</b></dd><dd className="sub">{lastSub}</dd></div>
          </dl>
          <UsageWeeks weeks={stats.weeks} unit={unit} />
        </>
      )}
    </section>
  );
}

export default function StrainDetail({ strain, options, tastes, mates, tests, stats, me, proposals = [], proposing = false }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [opts, setOpts] = useState(options);
  const serverMine = strain.entries.find((e) => e.userId === me.id);
  // stan „Mój wpis” z szybkich zapisów (także czekających w kolejce offline) do czasu odświeżenia z serwera
  const [local, setLocal] = useState(null);
  const mine = serverMine && local?.base === serverMine ? { ...serverMine, ...local.patch } : serverMine;
  const patchMine = (p) => setLocal((l) => ({ base: serverMine, patch: { ...(l?.base === serverMine ? l.patch : {}), ...p } }));
  useQueueEvents((d) => {
    if (!mine || d.item?.meta?.strainId !== strain.id || (d.item.kind !== 'usage' && d.item.kind !== 'purchase')) return;
    if ((d.type === 'removed' || d.type === 'rejected') && wasOptimistic(d.item.id)) {
      const r = revertOf(d.item);
      patchMine({ current: Math.max(Number(mine.current) + r.dCur, 0), ...(r.dRem ? { remaining: Number(mine.remaining) + r.dRem } : {}) });
    } else if (d.type === 'sent' && !hasQueued((i) => i.meta?.strainId === strain.id && i.kind !== 'symptoms')) router.refresh();
  });
  const others = strain.entries.filter((e) => e.userId !== me.id && (e.rating != null || e.notes));
  // ta sama średnia co na karcie odmiany na liście: wszystkie widoczne oceny, z moją włącznie
  const rated = strain.entries.filter((e) => e.rating != null);
  const avg = rated.length ? rated.reduce((a, e) => a + Number(e.rating), 0) / rated.length : null;
  const photo = strain.photo_v ? `/api/strains/${strain.id}/photo?v=${strain.photo_v}` : null;
  const ex = expiryInfo(strain.expires_on);
  const canDelete = me.isAdmin || strain.created_by === me.id;
  const kind = strain.kind ? `kind-${strain.kind}` : 'kind-none';
  const unit = unitOf(strain.form);
  const meta = [strain.type && strain.type !== 'nieokreślony' && cap(strain.type), strain.form && strain.form !== 'susz' && formLabel(strain.form)].filter(Boolean);
  const facts = [
    strain.taste && ['Smak i aromat', strain.taste],
    strain.form && ['Postać', `${formLabel(strain.form)} (ilości w ${unit})`],
    strain.batch && ['Seria', strain.batch],
    strain.expires_on && ['Ważne do', formatDay(strain.expires_on)],
    strain.price_per_g != null && !me.hidePrices && ['Cena', `${dec(strain.price_per_g)} zł/${unit}`],
  ].filter(Boolean);
  const heroFacts = [strain.thc != null && `THC ${dec(strain.thc)}%`, strain.cbd != null && `CBD ${dec(strain.cbd)}%`, strain.price_per_g != null && !me.hidePrices && `${dec(strain.price_per_g)} zł/${unit}`].filter(Boolean);
  const hasComposition = strain.thc != null || strain.cbd != null || strain.terpenes?.length > 0 || facts.length > 0;

  return (
    <div className="stack detail-page">
      {editing && (
        <div className="detail-bar">
          <Link href="/odmiany" className="back"><Icon name="chevronLeft" size={20} />Wszystkie odmiany</Link>
        </div>
      )}

      {editing ? (
        <StrainForm strain={strain} options={opts} tastes={tastes} canDelete={canDelete} proposing={proposing} hidePrice={me.hidePrices} onOptionsChange={setOpts}
          onDone={() => { setEditing(false); router.refresh(); }} onDeleted={() => router.push('/odmiany')}
          onCancel={() => setEditing(false)} />
      ) : (
        <>
          <header className={`hero dhero ${kind}${photo ? ' has-photo' : ' no-photo'}`} data-cat="strain">
            {!photo && <Jar drop={unit === 'ml'} />}
            <div className="detail-bar">
              <Link href="/odmiany" className="back"><Icon name="chevronLeft" size={20} />Odmiany</Link>
              <button type="button" className="btn ghost small" aria-label="Edytuj odmianę" onClick={() => setEditing(true)}><Icon name="edit" size={18} />Edytuj</button>
            </div>
            <div className="dhero-head">
              <p className="dhero-chips">
                {strain.kind
                  ? <span className={`hchip kind-${strain.kind}`}><i className="kind-dot" aria-hidden="true" />{cap(strain.kind)}</span>
                  : <span className="hchip">Rodzaj nieznany</span>}
                {meta.map((m) => <span key={m} className="hchip">{m}</span>)}
                {ex?.expired && <span className="hchip warn">Po terminie</span>}
                {ex?.soon && <span className="hchip warn">Ważne jeszcze {ex.days} {plural(ex.days, 'dzień', 'dni', 'dni')}</span>}
              </p>
              <h1 className="dn">{strain.name}</h1>
              <p className="dhero-producer"><span className="dn">{strain.producer}</span>{strain.batch && <> · partia {strain.batch}</>}</p>
              {heroFacts.length > 0 && <p className="dhero-chips">{heroFacts.map((f) => <span key={f} className="hchip strong">{f}</span>)}</p>}
            </div>
            {photo && (
              <div className="dhero-media">
                <Lightbox className="dhero-img dn-img" src={photo} alt={`Zdjęcie: ${strain.name}`} attr={strain.photo_attr} />
                <PhotoCredit attr={strain.photo_attr} />
              </div>
            )}
          </header>
          <dl className="dscores">
            <Score label="Końcowa" value={strain.final_rating} />
            <Score label="Średnia" value={avg} sub={rated.length ? `${rated.length} ${plural(rated.length, 'ocena', 'oceny', 'ocen')}` : 'brak ocen'} />
            <Score label="Moja" value={mine?.rating} solid sub={Number(mine?.current) > 0 ? `Mam ${num(mine.current)} ${unit}` : null} />
          </dl>

          <StrainProposals proposals={proposals} onChange={() => router.refresh()} />

          {((strain.created_by && strain.created_by !== me.id) || photo) && (
            <div className="row">
              {strain.created_by && strain.created_by !== me.id && <ReportButton type="strain" refId={strain.id} label="Zgłoś odmianę" />}
              {photo && <ReportButton type="photo" refId={strain.id} label="Zgłoś zdjęcie" />}
            </div>
          )}
        </>
      )}

      <MyStats stats={stats} unit={unit} />

      <section className="card dmine" aria-labelledby="dmine-h">
        <SecHead cat="stock" icon="jar" id="dmine-h">Mój wpis</SecHead>
        {mine && <OwnEntry strainId={strain.id} strainName={strain.name} form={strain.form} entry={mine} mates={mates} hidePrice={me.hidePrices}
          onSaved={(x) => {
            if (!x || 'rating' in x) return;
            // zakup lub zużycie: odśwież statystyki (bez sieci zostaje stan pokazany od razu, odświeżenie po wysłaniu kolejki)
            patchMine({ current: x.current, ...(x.remaining !== undefined ? { remaining: x.remaining } : {}) });
            if (navigator.onLine) router.refresh();
          }} />}
      </section>

      {!editing && hasComposition && (
        <section className="card dcomp" aria-labelledby="dcomp-h">
          <SecHead cat="strain" icon="flask" id="dcomp-h">Skład</SecHead>
          <div className="dcomp-body">
          <div>
          {(strain.thc != null || strain.cbd != null) && (
            <div className="meters">
              {strain.thc != null && <Meter label="THC" value={strain.thc} />}
              {strain.cbd != null && <Meter label="CBD" value={strain.cbd} />}
              <p className="meter-scale">Skala paska 0–{METER_MAX}%</p>
            </div>
          )}
          {strain.terpenes?.length > 0 && (
            <div className="dterp">
              <h3 className="dlabel">Terpeny</h3>
              <div className="chips">{strain.terpenes.map((t) => <Link key={t} href={`/wiedza#t-${t.toLowerCase().split(' ')[0]}`} className="chip dn">{t}</Link>)}</div>
            </div>
          )}
          </div>
          {facts.length > 0 && (
            <dl className="facts dfacts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          )}
          </div>
        </section>
      )}
      <CharacteristicCard strain={strain} hidePrice={me.hidePrices} compact />
      <PharmacyLink producer={strain.producer} name={strain.name} />

      <Effects strain={strain} meId={me.id} />

      <section className="card dopinions" aria-labelledby="dop-h">
        <SecHead cat="social" icon="users" id="dop-h">Opinie innych</SecHead>
        {others.length ? (
          <ul className="opinions">
            {others.map((e) => (
              <li key={e.userId}>
                <div className="op-head">
                  <Link href={`/u/${encodeURIComponent(e.username)}`} className="op-who">{e.displayName || e.username}</Link>
                  {e.rating != null && <span className="op-rating"><b>{dec(Number(e.rating))}</b>/10</span>}
                </div>
                {e.notes && <p className="op-note">{e.notes}</p>}
              </li>
            ))}
          </ul>
        ) : <p className="muted">Nie widzisz jeszcze opinii innych osób o tej odmianie.</p>}
      </section>

      <Tests strainId={strain.id} initialTests={tests} me={me} />

      <StrainHistory strainId={strain.id} isAdmin={me.isAdmin} hidePrice={me.hidePrices} />
    </div>
  );
}
