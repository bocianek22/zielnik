'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { KINDS } from '@/lib/kinds';
import { fileToDataUrl } from '@/lib/image';
import { FORMS } from '@/lib/forms';
import OptionSelect from './OptionSelect';
import TerpenePicker from './TerpenePicker';

// Formularz pól wspólnych: producent, odmiana, rodzaj, typ, THC/CBD, terpeny, opis, smak, zdjęcie
export default function StrainForm({ strain, options, tastes, canDelete, onOptionsChange, onDone, onDeleted, onCancel }) {
  const [f, setF] = useState({
    producer: strain?.producer ?? '',
    name: strain?.name ?? '',
    type: strain?.type ?? '',
    kind: strain?.kind ?? '',
    form: strain?.form ?? 'susz',
    thc: strain?.thc ?? '',
    cbd: strain?.cbd ?? '',
    finalRating: strain?.final_rating ?? '',
    taste: strain?.taste ?? '',
    terpenes: strain?.terpenes ?? [],
    description: strain?.description ?? '',
    price: strain?.price_per_g ?? '',
    batch: strain?.batch ?? '',
    expires: strain?.expires_on ?? '',
  });
  const [photo, setPhoto] = useState({ data: null, remove: false });
  const [sources, setSources] = useState(strain?.sources ?? []);
  const [auto, setAuto] = useState(strain?.description_auto ?? false);
  const [ai, setAi] = useState({ busy: false, msg: '' });
  const [catalog, setCatalog] = useState([]);
  useEffect(() => { api('/api/catalog').then((r) => setCatalog(r.items || [])).catch(() => {}); }, []);
  const nameSuggestions = [...new Set(catalog.filter((c) => !f.producer || c.producer.toLowerCase() === f.producer.toLowerCase()).map((c) => c.name))];
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const inp = (k) => ({ value: f[k] ?? '', onChange: (e) => set(k)(e.target.value) });

  const preview = photo.data || (strain?.photo_v && !photo.remove ? `/api/strains/${strain.id}/photo?v=${strain.photo_v}` : null);

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setPhoto({ data: await fileToDataUrl(file), remove: false }); setError(''); }
    catch (err) { setError(err.message); }
  }

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      let id = strain?.id;
      const body = { ...f, sources, descriptionAuto: auto };
      if (strain) await api(`/api/strains/${id}`, 'PATCH', body);
      else id = (await api('/api/strains', 'POST', body)).id;
      if (photo.data) await api(`/api/strains/${id}/photo`, 'PUT', { image: photo.data });
      else if (photo.remove) await api(`/api/strains/${id}/photo`, 'DELETE');
      await onDone();
    } catch (err) { setError(err.message); setBusy(false); }
  }

  async function suggest() {
    setAi({ busy: true, msg: '' });
    try {
      const r = await api('/api/strains/suggest', 'POST', { producer: f.producer, name: f.name });
      const s = r.suggestion;
      const replace = !f.description || confirm('Zastąpić obecny opis podpowiedzią z internetu?');
      setF((p) => ({
        ...p,
        description: replace ? s.description : p.description,
        terpenes: [...new Set([...p.terpenes, ...s.terpenes])],
        kind: p.kind || s.kind || '',
        thc: p.thc === '' || p.thc == null ? (s.thc ?? '') : p.thc,
        cbd: p.cbd === '' || p.cbd == null ? (s.cbd ?? '') : p.cbd,
        taste: p.taste || s.taste || '',
      }));
      if (replace) { setSources(r.sources || []); setAuto(true); }
      setAi({ busy: false, msg: `Uzupełniono pola (pewność: ${s.confidence}). Sprawdź je przed zapisem: THC i CBD z internetu są typowe dla odmiany, a Twoja partia może się różnić.` });
    } catch (err) { setAi({ busy: false, msg: err.message }); }
  }

  async function remove() {
    if (!confirm(`Usunąć odmianę „${strain.name}” razem ze wszystkimi ocenami i stanami?`)) return;
    setBusy(true);
    try { await api(`/api/strains/${strain.id}`, 'DELETE'); await (onDeleted || onDone)(); }
    catch (err) { setError(err.message); setBusy(false); }
  }

  const uid = strain ? `s${strain.id}` : 'new';
  return (
    <form className="card strain-form" onSubmit={submit}>
      <div className="mobile-form-bar">
        <button type="button" className="linklike" onClick={onCancel} aria-label="Zamknij">← Wróć</button>
        <span>{strain ? 'Edytuj odmianę' : 'Nowa odmiana'}</span>
        <span aria-hidden="true" style={{ width: 44 }} />
      </div>
      <h2 className="only-desktop">{strain ? 'Edytuj odmianę' : 'Nowa odmiana'}</h2>
      <div className="row">
        <div className="field grow">
          <label htmlFor={`${uid}-producer`}>Producent</label>
          <OptionSelect id={`${uid}-producer`} kind="producer" options={options.producer} value={f.producer}
            onChange={set('producer')} onOptionsChange={onOptionsChange} />
        </div>
        <div className="field grow">
          <label htmlFor={`${uid}-name`}>Odmiana</label>
          <input id={`${uid}-name`} className="input" maxLength={60} required list={`${uid}-names`} {...inp('name')} />
          <datalist id={`${uid}-names`}>{nameSuggestions.map((n) => <option key={n} value={n} />)}</datalist>
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${uid}-form`}>Postać</label>
        <select id={`${uid}-form`} className="input vis-select" {...inp('form')}>
          {FORMS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      <div className="field">
        <button type="button" className="btn ghost small" onClick={suggest} disabled={ai.busy || !f.producer || !f.name}>
          {ai.busy ? 'Szukam w internecie…' : 'Uzupełnij z internetu (podgląd)'}
        </button>
        {ai.msg && <p className="muted small" role="status">{ai.msg}</p>}
        <p className="muted small">Podpowiedź powstaje na podstawie serwisów o konopiach (np. Leafly, AllBud). Informacje są poglądowe i mogą być niepełne lub błędne. Ustal je z lekarzem.</p>
      </div>
      <div className="row">
        <div className="field grow">
          <label htmlFor={`${uid}-kind`}>Rodzaj (kolor karty)</label>
          <select id={`${uid}-kind`} className="input" {...inp('kind')}>
            <option value="">Nie wybrano</option>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div className="field grow">
          <label htmlFor={`${uid}-type`}>Typ</label>
          <OptionSelect id={`${uid}-type`} kind="type" options={options.type} value={f.type}
            onChange={set('type')} onOptionsChange={onOptionsChange} />
        </div>
      </div>
      <div className="row">
        <div className="field grow">
          <label htmlFor={`${uid}-thc`}>THC (%)</label>
          <input id={`${uid}-thc`} className="input" type="number" min="0" max="100" step="0.1" inputMode="decimal" {...inp('thc')} />
        </div>
        <div className="field grow">
          <label htmlFor={`${uid}-cbd`}>CBD (%)</label>
          <input id={`${uid}-cbd`} className="input" type="number" min="0" max="100" step="0.1" inputMode="decimal" {...inp('cbd')} />
        </div>
        <div className="field grow">
          <label htmlFor={`${uid}-final`}>Ocena końcowa (0–10)</label>
          <input id={`${uid}-final`} className="input" type="number" min="0" max="10" step="0.5" inputMode="decimal" {...inp('finalRating')} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${uid}-taste`}>Smak</label>
        <input id={`${uid}-taste`} className="input" list={`${uid}-tastes`} maxLength={120}
          placeholder="np. cytrusowy, ziemisty" {...inp('taste')} />
        <datalist id={`${uid}-tastes`}>{tastes.map((t) => <option key={t} value={t} />)}</datalist>
      </div>
      <div className="row">
        <div className="field grow">
          <label htmlFor={`${uid}-price`}>Cena za gram (zł)</label>
          <input id={`${uid}-price`} className="input" type="number" min="0" step="0.01" inputMode="decimal" {...inp('price')} />
        </div>
        <div className="field grow">
          <label htmlFor={`${uid}-batch`}>Numer serii</label>
          <input id={`${uid}-batch`} className="input" maxLength={40} {...inp('batch')} />
        </div>
        <div className="field grow">
          <label htmlFor={`${uid}-exp`}>Ważne do</label>
          <input id={`${uid}-exp`} className="input" type="date" {...inp('expires')} />
        </div>
      </div>
      <div className="field">
        <span className="label">Profil terpenowy</span>
        <TerpenePicker options={options.terpene} value={f.terpenes} onChange={set('terpenes')} onOptionsChange={onOptionsChange} />
      </div>
      <div className="field">
        <label htmlFor={`${uid}-desc`}>Opis (aromat, efekty, uwagi o profilu)</label>
        <textarea id={`${uid}-desc`} className="input" rows={3} maxLength={2000} {...inp('description')} />
      </div>
      <div className="field">
        <span className="label">Zdjęcie podglądowe</span>
        <div className="photo-edit">
          {preview ? <img className="strain-photo" src={preview} alt="Podgląd zdjęcia" /> : <div className="strain-photo ph">Brak zdjęcia</div>}
          <div className="photo-actions">
            <label className="btn ghost small file-btn">
              {preview ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
              <input type="file" accept="image/*" onChange={pickPhoto} hidden />
            </label>
            {preview && <button type="button" className="btn ghost small" onClick={() => setPhoto({ data: null, remove: true })}>Usuń zdjęcie</button>}
          </div>
        </div>
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
      <div className="row form-actions">
        <button className="btn" disabled={busy}>{busy ? 'Zapisuję…' : strain ? 'Zapisz zmiany' : 'Dodaj odmianę'}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Anuluj</button>
        {strain && canDelete && (
          <button type="button" className="btn danger push-right" disabled={busy} onClick={remove}>Usuń odmianę</button>
        )}
      </div>
    </form>
  );
}
