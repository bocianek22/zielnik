'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { KINDS } from '@/lib/kinds';
import { fileToDataUrl } from '@/lib/image';
import { FORMS } from '@/lib/forms';
import OptionSelect from './OptionSelect';
import TerpenePicker from './TerpenePicker';
import Icon from './Icon';

// Formularz pól wspólnych: producent, odmiana, rodzaj, typ, THC/CBD, terpeny, opis, smak, zdjęcie
// hidePrice: aplikacja natywna (lib/client.js); pole ceny znika, ale wartość zostaje w stanie, więc zapis jej nie kasuje
export default function StrainForm({ strain, options, tastes, canDelete, hidePrice = false, onOptionsChange, onDone, onDeleted, onCancel }) {
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
  const [fe, setFe] = useState({}); // błędy przy polach: { klucz: komunikat }
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const uid = strain ? `s${strain.id}` : 'new';
  const inp = (k) => ({ value: f[k] ?? '', onChange: (e) => set(k)(e.target.value) });
  // atrybuty błędu pola: aria-invalid i powiązanie z komunikatem
  const bad = (k) => (fe[k] ? { 'aria-invalid': true, 'aria-describedby': `${uid}-${k}-err` } : {});
  const err = (k) => (fe[k] ? <p id={`${uid}-${k}-err`} className="field-err">{fe[k]}</p> : null);

  const preview = photo.data || (strain?.photo_v && !photo.remove ? `/api/strains/${strain.id}/photo?v=${strain.photo_v}` : null);

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setPhoto({ data: await fileToDataUrl(file), remove: false }); setError(''); }
    catch (err) { setError(err.message); }
  }

  // zakresy sprawdzamy sami, żeby błąd stał przy polu (domyślne dymki przeglądarki są mało czytelne na telefonie)
  function validate() {
    const m = {};
    if (!String(f.name).trim()) m.name = 'Podaj nazwę odmiany.';
    if (!String(f.producer).trim()) m.producer = 'Wybierz producenta.';
    if (!String(f.type).trim()) m.type = 'Wybierz typ.';
    const rng = (k, label, max) => { const v = f[k]; if (v !== '' && v != null && !(Number(v) >= 0 && Number(v) <= max)) m[k] = `${label}: wartość od 0 do ${max}.`; };
    rng('thc', 'THC', 100); rng('cbd', 'CBD', 100); rng('finalRating', 'Ocena', 10);
    if (f.price !== '' && f.price != null && !(Number(f.price) >= 0)) m.price = 'Cena nie może być ujemna.';
    return m;
  }

  async function submit(e) {
    e.preventDefault();
    const m = validate();
    setFe(m);
    if (Object.keys(m).length) {
      setError('Popraw zaznaczone pola.');
      document.getElementById(`${uid}-${Object.keys(m)[0]}`)?.focus();
      return;
    }
    setError(''); setBusy(true);
    try {
      let id = strain?.id;
      const body = { ...f, sources, descriptionAuto: auto };
      if (strain) await api(`/api/strains/${id}`, 'PATCH', body);
      else id = (await api('/api/strains', 'POST', body)).id;
      try {
        if (photo.data) await api(`/api/strains/${id}/photo`, 'PUT', { image: photo.data });
        else if (photo.remove) await api(`/api/strains/${id}/photo`, 'DELETE');
      } catch (err) {
        // Dane odmiany są już zapisane; zdjęcie mogło zostać odrzucone (np. brak uprawnień do podmiany).
        setPhoto({ data: null, remove: false });
        setError(`Zmiany zapisano, ale zdjęcia nie: ${err.message}`);
        setBusy(false);
        return;
      }
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

  const title = strain ? 'Edytuj odmianę' : 'Nowa odmiana';
  const saveLabel = busy ? 'Zapisuję…' : strain ? 'Zapisz zmiany' : 'Dodaj odmianę';
  return (
    <form className="card strain-form" onSubmit={submit} noValidate aria-label={title}>
      <div className="mobile-form-bar">
        <button type="button" className="btn text" onClick={onCancel}><Icon name="chevronLeft" size={20} />Anuluj</button>
        <span className="bar-title">{title}</span>
        <button type="submit" className="btn small bar-save" disabled={busy}>{busy ? 'Zapisuję…' : 'Zapisz'}</button>
      </div>
      <h2 className="only-desktop">{title}</h2>
      {error && <div className="alert error" role="alert">{error}</div>}

      <h3 className="section-label">Podstawowe</h3>
      <div className="row">
        <div className="field grow">
          <label htmlFor={`${uid}-producer`}>Producent</label>
          <OptionSelect id={`${uid}-producer`} kind="producer" options={options.producer} value={f.producer}
            onChange={set('producer')} onOptionsChange={onOptionsChange} invalid={!!fe.producer} />
          {err('producer')}
        </div>
        <div className="field grow">
          <label htmlFor={`${uid}-name`}>Odmiana</label>
          <input id={`${uid}-name`} className="input" maxLength={60} list={`${uid}-names`} {...bad('name')} {...inp('name')} />
          <datalist id={`${uid}-names`}>{nameSuggestions.map((n) => <option key={n} value={n} />)}</datalist>
          {err('name')}
        </div>
      </div>
      <div className="row pair">
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
            onChange={set('type')} onOptionsChange={onOptionsChange} invalid={!!fe.type} />
          {err('type')}
        </div>
        <div className="field grow">
          <label htmlFor={`${uid}-form`}>Postać</label>
          <select id={`${uid}-form`} className="input vis-select" {...inp('form')}>
            {FORMS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
      </div>
      <div className="field suggest">
        <button type="button" className="btn ghost" onClick={suggest} disabled={ai.busy || !f.producer || !f.name}>
          {ai.busy ? 'Szukam w internecie…' : 'Uzupełnij z internetu (podgląd)'}
        </button>
        {ai.msg && <p className="muted small" role="status">{ai.msg}</p>}
        <p className="muted small">Podpowiedź powstaje na podstawie serwisów o konopiach (np. Leafly, AllBud). Informacje są poglądowe i mogą być niepełne lub błędne. Ustal je z lekarzem.</p>
      </div>

      <h3 className="section-label">Skład</h3>
      <div className="row nums">
        <div className="field grow">
          <label htmlFor={`${uid}-thc`}>THC (%)</label>
          <input id={`${uid}-thc`} className="input" type="number" min="0" max="100" step="0.1" inputMode="decimal" {...bad('thc')} {...inp('thc')} />
          {err('thc')}
        </div>
        <div className="field grow">
          <label htmlFor={`${uid}-cbd`}>CBD (%)</label>
          <input id={`${uid}-cbd`} className="input" type="number" min="0" max="100" step="0.1" inputMode="decimal" {...bad('cbd')} {...inp('cbd')} />
          {err('cbd')}
        </div>
      </div>
      <div className="field">
        <span className="label">Profil terpenowy</span>
        <TerpenePicker options={options.terpene} value={f.terpenes} onChange={set('terpenes')} onOptionsChange={onOptionsChange} />
      </div>
      <div className="field">
        <label htmlFor={`${uid}-taste`}>Smak</label>
        <input id={`${uid}-taste`} className="input" list={`${uid}-tastes`} maxLength={120}
          placeholder="np. cytrusowy, ziemisty" {...inp('taste')} />
        <datalist id={`${uid}-tastes`}>{tastes.map((t) => <option key={t} value={t} />)}</datalist>
      </div>

      <h3 className="section-label">Partia</h3>
      <div className="row pair">
        {!hidePrice && (
          <div className="field grow">
            <label htmlFor={`${uid}-price`}>Cena za gram (zł)</label>
            <input id={`${uid}-price`} className="input" type="number" min="0" step="0.01" inputMode="decimal" {...bad('price')} {...inp('price')} />
            {err('price')}
          </div>
        )}
        <div className="field grow">
          <label htmlFor={`${uid}-batch`}>Numer serii</label>
          <input id={`${uid}-batch`} className="input" maxLength={40} {...inp('batch')} />
        </div>
        <div className="field grow">
          <label htmlFor={`${uid}-exp`}>Ważne do</label>
          <input id={`${uid}-exp`} className="input" type="date" {...inp('expires')} />
        </div>
      </div>

      <h3 className="section-label">Opis i ocena</h3>
      <div className="field">
        <label htmlFor={`${uid}-finalRating`}>Ocena końcowa (0–10)</label>
        <input id={`${uid}-finalRating`} className="input narrow-input" type="number" min="0" max="10" step="0.5" inputMode="decimal" {...bad('finalRating')} {...inp('finalRating')} />
        {err('finalRating')}
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

      <div className="row form-actions">
        <button className="btn save-main" disabled={busy}>{saveLabel}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Anuluj</button>
        {strain && canDelete && (
          <button type="button" className="btn danger push-right" disabled={busy} onClick={remove}>Usuń odmianę</button>
        )}
      </div>
    </form>
  );
}
