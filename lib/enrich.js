import { ensureDb, sql } from './db';
import { invalidateStrains } from './cache';

export const ENRICH_ACTOR = 'Zielnik (katalog)';

// Klucz porównania: małe litery, bez polskich znaków i interpunkcji ("Cosma S.A." = "cosma s a")
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/gi, 'l')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Wpisy katalogu pasujące do odmiany: producent i nazwa muszą zgadzać się z nazwą główną lub aliasem.
// Samo THC/CBD nigdy nie wystarcza do dopasowania.
function matchEntries(strain, catalog) {
  const p = norm(strain.producer), n = norm(strain.name);
  return catalog.filter((e) => [e.producer, ...(e.producerAliases || [])].some((x) => norm(x) === p)
    && [e.name, ...(e.aliases || [])].some((x) => norm(x) === n));
}

// Uzupełnia wyłącznie puste pola odmian (smak, terpeny, opis) danymi z katalogu Zielnika.
// Pusty-warunek sprawdza sama baza w jednym zapytaniu, więc równoległa edycja użytkownika nie zostanie
// nadpisana. Zmiany trafiają do historii odmiany z autorem "Zielnik (katalog)"; ponowne uruchomienie
// nie dodaje wpisów (zapis tylko przy realnej zmianie).
// Odmiana pasująca do kilku wpisów jest pomijana i zwracana w `ambiguous`.
export async function enrichStrains(catalog, actor = ENRICH_ACTOR) {
  await ensureDb();
  const q = sql();
  const strains = await q`SELECT id, producer, name FROM strains ORDER BY id`;
  const res = { checked: strains.length, updated: 0, unchanged: 0, unmatched: 0, ambiguous: [], filled: { taste: 0, terpenes: 0, description: 0 } };
  for (const s of strains) {
    const found = matchEntries(s, catalog);
    if (!found.length) { res.unmatched++; continue; }
    if (found.length > 1) { res.ambiguous.push(`${s.producer} ${s.name}`); continue; }
    const e = found[0];
    const taste = String(e.taste || '').trim().slice(0, 120);
    const description = String(e.description || '').trim().slice(0, 2000);
    const terpenes = JSON.stringify(Array.isArray(e.terpenes) ? e.terpenes.slice(0, 12) : []);
    const sources = JSON.stringify((e.sources || []).slice(0, 5).map((x) => ({ title: String(x.title || '').slice(0, 120), url: x.url })));
    // dwa polecenia w jednej transakcji: blokada wiersza, potem zapis na świeżej migawce (jak w updateStrain)
    const [, rows] = await q.transaction([q`SELECT 1 FROM strains WHERE id = ${s.id} FOR UPDATE`, q`WITH old AS (
        SELECT id, jsonb_build_object('taste', taste, 'terpenes', terpenes, 'description', description, 'sources', sources, 'description_auto', description_auto) AS j
        FROM strains WHERE id = ${s.id} FOR UPDATE
      ), upd AS (
        UPDATE strains s SET
          taste = CASE WHEN btrim(s.taste) = '' AND ${taste} <> '' THEN ${taste} ELSE s.taste END,
          terpenes = CASE WHEN s.terpenes = '[]'::jsonb AND ${terpenes}::jsonb <> '[]'::jsonb THEN ${terpenes}::jsonb ELSE s.terpenes END,
          description = CASE WHEN btrim(s.description) = '' AND ${description} <> '' THEN ${description} ELSE s.description END,
          description_auto = CASE WHEN btrim(s.description) = '' AND ${description} <> '' THEN TRUE ELSE s.description_auto END,
          sources = CASE WHEN btrim(s.description) = '' AND ${description} <> '' AND s.sources = '[]'::jsonb THEN ${sources}::jsonb ELSE s.sources END
        FROM old WHERE s.id = old.id
        RETURNING s.id, old.j AS old_j,
          jsonb_build_object('taste', s.taste, 'terpenes', s.terpenes, 'description', s.description, 'sources', s.sources, 'description_auto', s.description_auto) AS new_j
      ), diff AS (
        SELECT u.id, (SELECT jsonb_object_agg(k, jsonb_build_array(u.old_j -> k, u.new_j -> k))
                      FROM jsonb_object_keys(u.new_j) k WHERE u.old_j -> k IS DISTINCT FROM u.new_j -> k) AS changes
        FROM upd u
      ), hist AS (
        INSERT INTO strain_edits (strain_id, user_id, actor, changes)
        SELECT id, NULL, ${actor}::text, changes FROM diff WHERE changes IS NOT NULL
      )
      SELECT changes FROM diff`], { isolationMode: 'ReadCommitted' });
    const ch = rows[0]?.changes;
    if (!ch) { res.unchanged++; continue; }
    res.updated++;
    for (const k of Object.keys(res.filled)) if (ch[k]) res.filled[k]++;
  }
  if (res.updated) invalidateStrains();
  return res;
}
