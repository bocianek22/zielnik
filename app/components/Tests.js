'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fileToDataUrl } from '@/lib/image';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

// Testy odmiany: wpisy z opisem i zdjęciem
export default function Tests({ strainId, initialTests, me }) {
  const [tests, setTests] = useState(initialTests);
  const [note, setNote] = useState('');
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setImage(await fileToDataUrl(file)); setError(''); } catch (err) { setError(err.message); }
  }

  async function add(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api(`/api/strains/${strainId}/tests`, 'POST', { note, image });
      setTests(r.tests); setNote(''); setImage(null);
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  async function remove(id) {
    if (!confirm('Usunąć ten test?')) return;
    try { await api(`/api/tests/${id}`, 'DELETE'); setTests((l) => l.filter((t) => t.id !== id)); }
    catch (err) { setError(err.message); }
  }

  return (
    <section className="card tests">
      <h2>Testy</h2>
      <form className="test-form" onSubmit={add}>
        <div className="field">
          <label htmlFor="test-note">Opis testu (sposób użycia, odczucia, wrażenia)</label>
          <textarea id="test-note" className="input" rows={3} maxLength={1500} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="photo-edit">
          {image && <img className="strain-photo" src={image} alt="Podgląd zdjęcia z testu" />}
          <label className="btn ghost small file-btn">
            {image ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
            <input type="file" accept="image/*" hidden onChange={pick} />
          </label>
          {image && <button type="button" className="btn ghost small" onClick={() => setImage(null)}>Usuń zdjęcie</button>}
          <button className="btn small" disabled={busy}>{busy ? 'Zapisuję…' : 'Dodaj test'}</button>
        </div>
        {error && <div className="alert error" role="alert">{error}</div>}
      </form>

      {tests.length === 0 ? <p className="muted">Nie ma jeszcze żadnych testów tej odmiany.</p> : (
        <ul className="test-list">
          {tests.map((t) => (
            <li key={t.id} className="test">
              {t.hasPhoto && (
                <a href={`/api/tests/${t.id}/photo`} target="_blank" rel="noreferrer">
                  <img className="test-photo" src={`/api/tests/${t.id}/photo`} alt="Zdjęcie z testu" loading="lazy" />
                </a>
              )}
              <div className="test-body">
                <p className="test-meta"><b>{t.username || 'Usunięty użytkownik'}</b><span>{fmtDate(t.createdAt)}</span></p>
                {t.note && <p className="test-note">{t.note}</p>}
                {(me.isAdmin || t.userId === me.id) && (
                  <button className="btn ghost small" onClick={() => remove(t.id)}>Usuń</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
