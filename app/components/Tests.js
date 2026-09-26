'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fileToDataUrl } from '@/lib/image';
import { VIS, visLabel } from '@/lib/visibility';
import ReportButton from './ReportButton';
import Lightbox from './Lightbox';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
const photoUrl = (t) => `/api/tests/${t.id}/photo?v=${t.pv}`;

// Formularz testu: dodawanie (bez `test`) i edycja (z `test`)
function TestForm({ test, onSubmit, onCancel, busy, error }) {
  const [note, setNote] = useState(test?.note ?? '');
  const [vis, setVis] = useState(test?.visibility ?? 'me');
  const [image, setImage] = useState(null);       // nowe zdjęcie
  const [removePhoto, setRemovePhoto] = useState(false);
  const [err, setErr] = useState('');
  const current = image || (test?.hasPhoto && !removePhoto ? photoUrl(test) : null);
  const id = test ? `t${test.id}` : 'new';

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) try { setImage(await fileToDataUrl(file)); setRemovePhoto(false); setErr(''); } catch (x) { setErr(x.message); }
  }
  return (
    <form className="test-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ note, visibility: vis, image, removePhoto }); }}>
      <div className="field">
        <label htmlFor={`${id}-note`}>Opis testu (sposób użycia, odczucia, wrażenia)</label>
        <textarea id={`${id}-note`} className="input" rows={3} maxLength={1500} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-vis`}>Kto widzi ten test</label>
        <select id={`${id}-vis`} className="input vis-select" value={vis} onChange={(e) => setVis(e.target.value)}>
          {VIS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      <div className="photo-edit">
        {current && <img className="strain-photo" src={current} alt="Zdjęcie z testu" />}
        <label className="btn ghost small file-btn">{current ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}<input type="file" accept="image/*" hidden onChange={pick} /></label>
        {current && <button type="button" className="btn ghost small" onClick={() => { setImage(null); setRemovePhoto(true); }}>Usuń zdjęcie</button>}
        <button className="btn small" disabled={busy}>{busy ? 'Zapisuję…' : test ? 'Zapisz zmiany' : 'Dodaj test'}</button>
        {onCancel && <button type="button" className="btn ghost small" onClick={onCancel}>Anuluj</button>}
      </div>
      {(err || error) && <div className="alert error" role="alert">{err || error}</div>}
    </form>
  );
}

// Testy odmiany: wpisy z opisem i zdjęciem (można je edytować)
export default function Tests({ strainId, initialTests, me }) {
  const [tests, setTests] = useState(initialTests);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(fn) {
    setBusy(true); setError('');
    try { await fn(); return true; } catch (e) { setError(e.message); return false; } finally { setBusy(false); }
  }
  const add = (d) => run(async () => { setTests((await api(`/api/strains/${strainId}/tests`, 'POST', { note: d.note, image: d.image, visibility: d.visibility })).tests); });
  const save = (id, d) => run(async () => {
    setTests((await api(`/api/tests/${id}`, 'PATCH', { note: d.note, visibility: d.visibility, image: d.image, removePhoto: d.removePhoto })).tests);
    setEditing(null);
  });
  async function remove(id) {
    if (!confirm('Usunąć ten test?')) return;
    try { await api(`/api/tests/${id}`, 'DELETE'); setTests((l) => l.filter((t) => t.id !== id)); } catch (e) { setError(e.message); }
  }

  return (
    <section className="card tests">
      <h2>Testy</h2>
      <TestForm key={tests.length} onSubmit={add} busy={busy} error={editing ? '' : error} />
      {tests.length === 0 ? <p className="muted">Nie ma jeszcze żadnych testów tej odmiany.</p> : (
        <ul className="test-list">
          {tests.map((t) => (
            <li key={t.id} className="test">
              {editing === t.id ? (
                <div className="test-body" style={{ width: '100%' }}>
                  <TestForm test={t} onSubmit={(d) => save(t.id, d)} onCancel={() => setEditing(null)} busy={busy} error={error} />
                </div>
              ) : (
                <>
                  {t.hasPhoto && <Lightbox className="test-photo" src={photoUrl(t)} alt="Zdjęcie z testu" />}
                  <div className="test-body">
                    <p className="test-meta"><b>{t.username || 'Usunięty użytkownik'}</b>{t.userId === me.id && <span className="badge">{visLabel(t.visibility)}</span>}<span>{fmtDate(t.createdAt)}</span></p>
                    {t.note && <p className="test-note">{t.note}</p>}
                    <div className="row">
                      {t.userId && t.userId !== me.id && <ReportButton type="test" userId={t.userId} refId={t.id} />}
                      {t.userId === me.id && <button className="btn ghost small" onClick={() => { setError(''); setEditing(t.id); }}>Edytuj</button>}
                      {(me.isAdmin || t.userId === me.id) && <button className="btn ghost small" onClick={() => remove(t.id)}>Usuń</button>}
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
