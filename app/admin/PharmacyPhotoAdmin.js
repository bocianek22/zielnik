'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fileToDataUrl } from '@/lib/image';
import { FORMS, formLabel } from '@/lib/forms';
import { KINDS } from '@/lib/kinds';
import { IMAGE_MAX_PX, MAX_IMAGES, MAX_TOTAL_BYTES, concText, toCatalogRow, toCsv, unitFor } from '@/lib/pharmacy-ocr';
import Icon from '../components/Icon';

const LABELS = {
  producer: 'Producent', name: 'Odmiana (nazwa w katalogu)', registeredName: 'Nazwa rejestrowa', form: 'Postać',
  thc: 'THC', cbd: 'CBD', concUnit: 'Jednostka stężenia', size: 'Opakowanie', price: 'Cena opakowania (zł)', kind: 'Rodzaj',
};
const dec = (v) => String(v ?? '').replace('.', ',');

// Jedno pole wiersza; pole oznaczone przez model jako niepewne ma ostrzeżenie, które znika po poprawce
function Field({ row, k, onChange, children, unit }) {
  const id = `ph-${row.id}-${k}`;
  const unsure = row.uncertain.includes(k);
  return (
    <div className={`field ph-field${unsure ? ' unsure' : ''}`}>
      <label htmlFor={id}>{LABELS[k]}{unit ? ` (${unit})` : ''}{unsure && <span className="badge low">Niepewne</span>}</label>
      {children ? children(id) : (
        <input id={id} className="input" value={row[k]} aria-invalid={unsure || undefined}
          inputMode={['thc', 'cbd', 'size', 'price'].includes(k) ? 'decimal' : undefined}
          onChange={(e) => onChange(k, e.target.value)} />
      )}
    </div>
  );
}

export default function PharmacyPhotoAdmin() {
  const [cfg, setCfg] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { api('/api/admin/pharmacy-photo').then(setCfg).catch(() => setCfg({ configured: false })); }, []);

  async function pick(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    setErr('');
    const room = MAX_IMAGES - photos.length;
    if (files.length > room) setErr(`Najwyżej ${MAX_IMAGES} zdjęcia naraz.`);
    try {
      // zmniejszenie w przeglądarce: lżejsze wysyłanie i mniej tokenów, a cennik nadal czytelny
      const added = await Promise.all(files.slice(0, Math.max(0, room)).map((f) => fileToDataUrl(f, IMAGE_MAX_PX, 0.85)));
      setPhotos((p) => [...p, ...added].slice(0, MAX_IMAGES));
    } catch (x) { setErr(x.message); }
  }

  async function read() {
    setErr(''); setMsg('');
    // ten sam limit co na serwerze; większe żądanie Vercel odrzuca bez czytelnego komunikatu
    if (photos.reduce((n, p) => n + p.length, 0) * 0.75 > MAX_TOTAL_BYTES) return setErr('Zdjęcia są razem za duże. Usuń jedno i spróbuj ponownie.');
    setBusy('read');
    try {
      const r = await api('/api/admin/pharmacy-photo', 'POST', { images: photos });
      setRows(r.rows.map((x, i) => ({ ...x, id: i, startOpen: x.uncertain.length > 0 })));
      setPhotos([]); // zdjęcia nie są nigdzie zapisywane
      if (!r.rows.length) setMsg('Nie znaleziono na zdjęciu pozycji z konopi medycznych.');
    } catch (x) { setErr(x.message); }
    setBusy('');
  }

  const update = (id, k, v) => setRows((rs) => rs.map((r) => {
    if (r.id !== id) return r;
    const next = { ...r, [k]: v, uncertain: r.uncertain.filter((f) => f !== k) };
    if (k === 'form') next.unit = unitFor(v);
    return next;
  }));
  const remove = (id) => setRows((rs) => rs.filter((r) => r.id !== id));
  const valid = (rows || []).filter((r) => r.producer.trim() && r.name.trim());

  function download() {
    const url = URL.createObjectURL(new Blob([toCsv(valid)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `apteka-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(toCsv(valid).replace(/^﻿/, '')); setMsg('Skopiowano CSV do schowka.'); }
    catch { setErr('Nie udało się skopiować. Użyj „Pobierz CSV”.'); }
  }
  async function importRows() {
    setBusy('import'); setErr(''); setMsg('');
    try {
      const r = await api('/api/catalog', 'POST', { rows: valid.map(toCatalogRow), mode: 'zdjecie' });
      setMsg(`Zapisano w katalogu: ${r.upserted} (nowe i uzupełnione istniejące), pominięte: ${r.skippedCount}.${r.skipped.length ? ` ${r.skipped.join(', ')}` : ''}`);
      setRows((rs) => rs.map((x) => ({ ...x, exists: true })));
    } catch (x) { setErr(x.message); }
    setBusy('');
  }

  return (
    <section className="admin-sec">
      <h2 className="section-label">Zdjęcie z apteki → CSV</h2>
      <p className="muted small admin-note">Zrób zdjęcie listy produktów, półki albo cennika apteki (do {MAX_IMAGES} zdjęć). Model odczyta pozycje z konopi: nazwę rejestrową, producenta, odmianę, THC i CBD, postać, opakowanie i cenę. Sprawdź tabelę: pola oznaczone „Niepewne” popraw ręcznie, zbędne wiersze usuń. „Importuj do katalogu” dodaje nowe pozycje i uzupełnia istniejące (ten sam producent i nazwa), nie oznacza innych jako „Brak w źródle”. Oleje („Extractum…”) i wkłady mają opakowanie w ml. Zdjęcia nie są zapisywane.</p>

      {cfg && !cfg.configured && (
        <div className="alert note" role="status">Odczyt zdjęć jest wyłączony. Ustaw w Vercel (Settings → Environment Variables) zmienną <code>ANTHROPIC_API_KEY</code> z kluczem z console.anthropic.com i wdróż ponownie. Opcjonalnie <code>ZIELNIK_VISION_MODEL</code> (domyślnie <code>claude-opus-5-5</code>).</div>
      )}

      {cfg?.configured && (
        <div className="card ph-pick">
          <div className="admin-actions-bar">
            <label className="btn ghost file-btn"><Icon name="camera" size={20} />Zrób zdjęcie
              <input type="file" accept="image/*" capture="environment" hidden onChange={pick} disabled={photos.length >= MAX_IMAGES} /></label>
            <label className="btn ghost file-btn"><Icon name="file" size={20} />Wybierz zdjęcia
              <input type="file" accept="image/*" multiple hidden onChange={pick} disabled={photos.length >= MAX_IMAGES} /></label>
          </div>
          {photos.length > 0 && (
            <>
              <ul className="ph-thumbs" aria-label="Wybrane zdjęcia">
                {photos.map((p, i) => (
                  <li key={i}>
                    <img src={p} alt={`Zdjęcie ${i + 1}`} />
                    <button type="button" className="btn text small" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} aria-label={`Usuń zdjęcie ${i + 1}`}><Icon name="close" size={18} /></button>
                  </li>
                ))}
              </ul>
              <button className="btn" onClick={read} disabled={busy === 'read'}>{busy === 'read' ? 'Odczytuję… (do minuty)' : `Odczytaj ${photos.length > 1 ? `${photos.length} zdjęcia` : 'zdjęcie'}`}</button>
            </>
          )}
        </div>
      )}

      {err && <div className="alert error" role="alert">{err}</div>}
      {msg && <div className="alert note" role="status">{msg}</div>}

      {rows?.length > 0 && (
        <>
          <p className="muted small ph-count">Pozycji: {rows.length}{rows.some((r) => r.uncertain.length) && ` · do sprawdzenia: ${rows.filter((r) => r.uncertain.length).length}`}</p>
          <ul className="list ph-rows">
            {rows.map((r) => (
              <li key={r.id}>
                <details className="admin-user" open={r.startOpen}>
                  <summary className="list-row">
                    <div className="lr-main">
                      <span className="admin-name">{r.name || '(bez nazwy)'}</span>
                      <span className="lr-sub">{[r.producer, formLabel(r.form), concText(r), r.size && `${dec(r.size)} ${r.unit}`, r.price && `${dec(r.price)} zł`].filter(Boolean).join(' · ')}</span>
                      <span className="ph-tags">
                        <span className="badge">{r.exists ? 'Jest w katalogu' : 'Nowa'}</span>
                        {r.uncertain.length > 0 && <span className="badge low">Niepewne: {r.uncertain.length}</span>}
                      </span>
                    </div>
                    <Icon name="chevronDown" size={20} className="lr-chev" />
                  </summary>
                  <div className="admin-user-body ph-edit">
                    <Field row={r} k="producer" onChange={(k, v) => update(r.id, k, v)} />
                    <Field row={r} k="name" onChange={(k, v) => update(r.id, k, v)} />
                    <Field row={r} k="registeredName" onChange={(k, v) => update(r.id, k, v)} />
                    <div className="ph-pair">
                      <Field row={r} k="form">{(id) => (
                        <select id={id} className="input" value={r.form} onChange={(e) => update(r.id, 'form', e.target.value)}>
                          {FORMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      )}</Field>
                      <Field row={r} k="kind">{(id) => (
                        <select id={id} className="input" value={r.kind} onChange={(e) => update(r.id, 'kind', e.target.value)}>
                          <option value="">Nieznany</option>
                          {KINDS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                        </select>
                      )}</Field>
                    </div>
                    <div className="ph-pair">
                      <Field row={r} k="thc" onChange={(k, v) => update(r.id, k, v)} />
                      <Field row={r} k="cbd" onChange={(k, v) => update(r.id, k, v)} />
                      <Field row={r} k="concUnit">{(id) => (
                        <select id={id} className="input" value={r.concUnit} onChange={(e) => update(r.id, 'concUnit', e.target.value)}>
                          <option value="">brak</option><option value="%">%</option><option value="mg/ml">mg/ml</option><option value="mg/g">mg/g</option>
                        </select>
                      )}</Field>
                    </div>
                    <div className="ph-pair">
                      <Field row={r} k="size" unit={r.unit} onChange={(k, v) => update(r.id, k, v)} />
                      <Field row={r} k="price" onChange={(k, v) => update(r.id, k, v)} />
                    </div>
                    {r.concUnit !== '%' && (r.thc || r.cbd) && <p className="muted small">Katalog pokazuje THC i CBD w %, więc stężenie w {r.concUnit || 'innej jednostce'} trafi tylko do CSV (kolumna „Stężenie”).</p>}
                    <button type="button" className="btn text small ph-del" onClick={() => remove(r.id)}><Icon name="close" size={18} />Usuń wiersz</button>
                  </div>
                </details>
              </li>
            ))}
          </ul>
          {valid.length < rows.length && <p className="muted small">Wiersze bez producenta lub nazwy ({rows.length - valid.length}) nie trafią do CSV ani do katalogu.</p>}
          <div className="admin-actions-bar">
            <button className="btn" onClick={importRows} disabled={!valid.length || busy === 'import'}>{busy === 'import' ? 'Importuję…' : `Importuj do katalogu (${valid.length})`}</button>
            <button className="btn ghost" onClick={download} disabled={!valid.length}><Icon name="download" size={20} />Pobierz CSV</button>
            <button className="btn ghost" onClick={copy} disabled={!valid.length}><Icon name="clipboard" size={20} />Kopiuj CSV</button>
          </div>
          <p className="muted small">Pobrany plik możesz też wczytać w Katalogu („Wczytaj CSV”), ale wtedy działa pełna synchronizacja: pozycje z poprzedniego ręcznego importu, których w pliku nie ma, dostaną „Brak w źródle”.</p>
        </>
      )}
    </section>
  );
}
