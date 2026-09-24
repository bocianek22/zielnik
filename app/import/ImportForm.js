'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

const MAP = {
  'odmiana': 'name', 'producent': 'producer', 'rodzaj': 'kind', 'typ': 'type', 'thc %': 'thc', 'thc': 'thc',
  'cbd %': 'cbd', 'cbd': 'cbd', 'cena zł/g': 'price', 'cena': 'price', 'seria': 'batch', 'ważne do': 'expires',
  'smak': 'taste', 'postać': 'form', 'postac': 'form', 'terpeny': 'terpenes', 'ocena końcowa': 'finalRating', 'twoja ocena': 'rating',
  'mam teraz g': 'current', 'do wykupienia g': 'remaining', 'spostrzeżenia': 'notes',
};

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split('\n')[0];
  const delim = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  const endRow = () => { row.push(cur); cur = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; endRow(); }
    else cur += c;
  }
  if (cur !== '' || row.length) endRow();
  return rows;
}

export default function ImportForm() {
  const [rows, setRows] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setResult(null); setError('');
    if (!file) return;
    const table = parseCsv(await file.text());
    if (table.length < 2) { setRows(null); return setError('Plik jest pusty albo ma tylko nagłówek.'); }
    const keys = table[0].map((h) => MAP[h.trim().toLowerCase()]);
    if (!keys.includes('name')) { setRows(null); return setError('Brak kolumny „Odmiana” w nagłówku.'); }
    setRows(table.slice(1).map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i]]).filter(([k]) => k))));
  }

  async function run() {
    setBusy(true); setError('');
    try { setResult(await api('/api/import', 'POST', { rows })); setRows(null); }
    catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <div className="card stack">
      <p>Wybierz plik CSV z kolumnami takimi jak w <a href="/api/export">eksporcie</a> (wystarczy „Odmiana”, „Producent” i „Typ”; reszta jest opcjonalna). Odmiany, które już masz (ta sama nazwa i producent), zostaną pominięte. Twoje oceny, stany i „Do wykupienia” zapiszą się na Twoim koncie.</p>
      <label className="btn ghost file-btn">Wybierz plik CSV<input type="file" accept=".csv,text/csv" hidden onChange={pick} /></label>
      {rows && (
        <div className="row">
          <span>Wczytano wierszy: <b>{rows.length}</b></span>
          <button className="btn" disabled={busy} onClick={run}>{busy ? 'Importuję…' : 'Importuj'}</button>
        </div>
      )}
      {error && <div className="alert error" role="alert">{error}</div>}
      {result && (
        <div className="alert note" role="status">
          Dodano: <b>{result.added}</b>, pominięto (już istnieją): <b>{result.skipped}</b>.
          {result.truncated && <> Zaimportowano tylko pierwsze 200 wierszy.</>}
          {result.errors.length > 0 && <ul>{result.errors.map((m) => <li key={m}>{m}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
