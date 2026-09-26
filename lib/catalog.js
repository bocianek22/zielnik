import { ensureDb, sql } from './db';
import { KINDS } from './kinds';
import { parseNumber } from './strains';
import { FORM_VALUES } from './forms';

const KEYS = {
  producent: 'producer', producer: 'producer', odmiana: 'name', nazwa: 'name', name: 'name',
  thc: 'thc', 'thc %': 'thc', cbd: 'cbd', 'cbd %': 'cbd', rodzaj: 'kind', kind: 'kind',
  postać: 'form', postac: 'form', form: 'form',
  'dostępność': 'availability', dostepnosc: 'availability', availability: 'availability',
};
const num = (v) => parseNumber(String(v ?? '').replace('%', '').replace(',', '.').trim(), 0, 100);

// Wczytuje listę do katalogu: dodaje nowe, odświeża istniejące, a pozycje z tego samego źródła
// nieobecne w tym przebiegu oznacza jako nieaktywne ("brak w źródle").
export async function syncCatalog(rawRows, source) {
  await ensureDb();
  const q = sql();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let upserted = 0;
  const skipped = [];
  for (const raw of rawRows.slice(0, 2000)) {
    const r = {};
    for (const [k, v] of Object.entries(raw)) { const key = KEYS[String(k).trim().toLowerCase()]; if (key) r[key] = v; }
    const producer = String(r.producer ?? '').trim().slice(0, 60);
    const name = String(r.name ?? '').trim().slice(0, 80);
    const thc = num(r.thc), cbd = num(r.cbd);
    if (!producer || !name || Number.isNaN(thc) || Number.isNaN(cbd)) { skipped.push(name || producer || '(pusty)'); continue; }
    const kindRaw = String(r.kind ?? '').trim().toLowerCase();
    const kind = KINDS.some((k) => k.value === kindRaw) ? kindRaw : null;
    const formRaw = String(r.form ?? '').trim().toLowerCase();
    const form = FORM_VALUES.includes(formRaw) ? formRaw : 'susz';
    const availability = String(r.availability ?? '').trim().slice(0, 30) || null;
    await q`INSERT INTO market_catalog (producer, name, thc, cbd, kind, availability, source, run_id, last_seen, active, form)
            VALUES (${producer}, ${name}, ${thc}, ${cbd}, ${kind}, ${availability}, ${source}, ${runId}, now(), TRUE, ${form})
            ON CONFLICT (lower(producer), lower(name)) DO UPDATE SET
              thc = EXCLUDED.thc, cbd = EXCLUDED.cbd, kind = COALESCE(EXCLUDED.kind, market_catalog.kind),
              availability = EXCLUDED.availability, source = EXCLUDED.source, run_id = EXCLUDED.run_id,
              last_seen = now(), active = TRUE, form = EXCLUDED.form`;
    upserted++;
  }
  let deactivated = 0;
  if (upserted > 0) {
    const off = await q`UPDATE market_catalog SET active = FALSE
                        WHERE source = ${source} AND run_id IS DISTINCT FROM ${runId} AND active RETURNING id`;
    deactivated = off.length;
  }
  return { upserted, deactivated, skippedCount: skipped.length, skipped: skipped.slice(0, 10) };
}

export async function listCatalog() {
  await ensureDb();
  return sql()`SELECT id, producer, name, thc::float8 AS thc, cbd::float8 AS cbd, kind, form, availability, source, active,
                      to_char(last_seen AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS last_seen
               FROM market_catalog ORDER BY active DESC, lower(producer), lower(name)`;
}
