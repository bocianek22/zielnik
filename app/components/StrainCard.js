'use client';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';

const fmt = (n) => (n == null ? '–' : String(Number(n)));

// Edytowalne, osobiste pola zalogowanego użytkownika (autozapis po opuszczeniu pola)
function OwnEntry({ strainId, entry, onSaved }) {
  const [f, setF] = useState({
    rating: entry.rating ?? '', current: entry.current ?? 0, remaining: entry.remaining ?? 0, notes: entry.notes ?? '',
  });
  const [status, setStatus] = useState({ kind: 'idle', msg: '' });
  const last = useRef(JSON.stringify(f));
  const id = `e${strainId}`;

  async function save() {
    const key = JSON.stringify(f);
    if (key === last.current) return;
    setStatus({ kind: 'saving', msg: 'Zapisuję…' });
    try {
      const r = await api(`/api/strains/${strainId}/entry`, 'PUT', f);
      last.current = key;
      onSaved(r.entry);
      setStatus({ kind: 'ok', msg: 'Zapisano' });
    } catch (e) { setStatus({ kind: 'err', msg: e.message }); }
  }
  const bind = (k) => ({ value: f[k], onChange: (e) => setF((p) => ({ ...p, [k]: e.target.value })), onBlur: save });

  return (
    <div className="entry mine">
      <div className="entry-who">Twoje pola <span className={`save-state ${status.kind}`} role="status">{status.msg}</span></div>
      <div className="entry-field">
        <label htmlFor={`${id}-r`}>Ocena</label>
        <input id={`${id}-r`} className="input" type="number" min="0" max="10" step="0.5" inputMode="decimal" {...bind('rating')} />
      </div>
      <div className="entry-field">
        <label htmlFor={`${id}-c`}>Mam teraz (g)</label>
        <input id={`${id}-c`} className="input" type="number" min="0" step="0.1" inputMode="decimal" {...bind('current')} />
      </div>
      <div className="entry-field">
        <label htmlFor={`${id}-m`}>Do wykupienia (g)</label>
        <input id={`${id}-m`} className="input" type="number" min="0" step="0.1" inputMode="decimal" {...bind('remaining')} />
      </div>
      <div className="entry-field notes">
        <label htmlFor={`${id}-n`}>Spostrzeżenia</label>
        <textarea id={`${id}-n`} className="input" rows={2} maxLength={1000} {...bind('notes')} />
      </div>
    </div>
  );
}

function OtherEntry({ e }) {
  return (
    <div className="entry">
      <div className="entry-who">{e.username}</div>
      <div className="entry-field"><span className="lbl">Ocena</span><b>{fmt(e.rating)}</b></div>
      <div className="entry-field"><span className="lbl">Ma teraz</span><b>{fmt(e.current)} g</b></div>
      <div className="entry-field"><span className="lbl">Do wykupienia</span><b>{fmt(e.remaining)} g</b></div>
      <div className="entry-field notes"><span className="lbl">Spostrzeżenia</span><span>{e.notes || '–'}</span></div>
    </div>
  );
}

export default function StrainCard({ strain, meId, onEdit, onEntrySaved }) {
  const mine = strain.entries.find((e) => e.userId === meId);
  const others = strain.entries.filter((e) => e.userId !== meId);
  const rated = strain.entries.filter((e) => e.rating != null);
  const avg = rated.length ? (rated.reduce((a, e) => a + Number(e.rating), 0) / rated.length).toFixed(1) : null;

  const photoSrc = `/api/strains/${strain.id}/photo?v=${strain.photo_v}`;

  return (
    <article className={`card strain k-${strain.kind || 'none'}`}>
      <header className="strain-head">
        {strain.photo_v && (
          <a href={photoSrc} target="_blank" rel="noreferrer" className="photo-link">
            <img className="strain-photo" src={photoSrc} alt={`Zdjęcie: ${strain.name}`} loading="lazy" />
          </a>
        )}
        <div className="strain-title">
          <h3>{strain.name}</h3>
          <p className="strain-meta">
            <span>{strain.producer}</span>
            {strain.kind && <span className={`badge kind-${strain.kind}`}>{strain.kind}</span>}
            <span className="badge">{strain.type}</span>
          </p>
          <p className="strain-meta">
            {strain.thc != null && <span className="pill">THC {strain.thc}%</span>}
            {strain.cbd != null && <span className="pill">CBD {strain.cbd}%</span>}
          </p>
          {strain.taste && <p className="strain-taste">Smak: {strain.taste}</p>}
          {strain.terpenes?.length > 0 && (
            <div className="chips small">{strain.terpenes.map((t) => <span key={t} className="chip on static">{t}</span>)}</div>
          )}
          {strain.description && (
            <details className="strain-desc"><summary>Opis</summary><p>{strain.description}</p></details>
          )}
        </div>
        <div className="scores">
          <div className="score" title="Ocena końcowa">
            <b>{strain.final_rating ?? '–'}</b><small>ocena końcowa</small>
          </div>
          {avg && <div className="score soft" title="Średnia ocen użytkowników">
            <b>{avg}</b><small>średnia ({rated.length})</small>
          </div>}
        </div>
      </header>

      <div className="entries">
        {mine && <OwnEntry strainId={strain.id} entry={mine} onSaved={(en) => onEntrySaved(strain.id, en)} />}
        {others.map((e) => <OtherEntry key={e.userId} e={e} />)}
      </div>

      <div className="strain-foot">
        <button className="btn ghost small" onClick={onEdit}>Edytuj pola wspólne</button>
      </div>
    </article>
  );
}
