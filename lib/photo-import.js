import { ensureDb, sql } from './db';
import { putPhoto, deletePhotos } from './photos';
import { cleanImage, sniffMime } from './image-meta';

// Import zdjęć z wolnych licencji (manifest data/zdjecia.json) do odmian, które nie mają zdjęcia.
// Przypisujemy wyłącznie wpisy zweryfikowane (verified), z depicts = 'odmiana' i nazwą odmiany pasującą do odmiany w bazie.
// Zdjęcia poglądowe nigdy nie trafiają automatycznie do konkretnych odmian. Istniejących zdjęć (także użytkowników) nie ruszamy:
// zapis to INSERT ... ON CONFLICT DO NOTHING, więc import jest idempotentny i bezpieczny przy równoległym dodaniu zdjęcia.
// Zmniejszanie: manifest wskazuje gotową miniaturę (thumbUrl, ok. 960 px) z serwera źródła; lib/image.js działa tylko w przeglądarce.
const HOSTS = new Set(['upload.wikimedia.org', 'live.staticflickr.com']);
const LICENSE = /^(domena publiczna|public domain|cc0|cc by(-sa)? \d(\.\d)?)/i;
const MAX_BYTES = 650_000; // po base64 mieści się w limicie 900 tys. znaków trasy PUT zdjęcia
const IMPORT_UA = 'Zielnik/0.34 (kontakt przez repozytorium)';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/gi, 'l')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const importable = (p) => !!p && p.verified === true && p.depicts === 'odmiana' && !!p.strain && !!p.author
  && LICENSE.test(String(p.license || '')) && /^https:\/\/[^/]+\//.test(String(p.thumbUrl || p.fileUrl || ''));

const MAX_REDIRECTS = 3;
// adresy licencji i źródła trafiają do linków w Lightbox: tylko https
const httpsUrl = (u) => { try { return new URL(u).protocol === 'https:' ? String(u).slice(0, 500) : null; } catch { return null; } };

// Pobranie tylko z dozwolonych hostów: przekierowania obsługujemy sami i każde sprawdzamy (fetch z redirect: 'follow'
// poszedłby pod dowolny adres, zanim zdążylibyśmy go zobaczyć). Rozmiar sprawdzamy przed pobraniem treści.
async function download(photo, fetchFn) {
  let url = new URL(photo.thumbUrl || photo.fileUrl);
  let r;
  for (let hop = 0; ; hop++) {
    if (url.protocol !== 'https:' || !HOSTS.has(url.hostname)) throw new Error('niedozwolony host');
    r = await fetchFn(url.href, { headers: { 'User-Agent': IMPORT_UA }, redirect: 'manual', signal: AbortSignal.timeout(20000) });
    if (r.status < 300 || r.status > 399) break;
    const loc = r.headers.get('location');
    if (!loc || hop >= MAX_REDIRECTS) throw new Error('zbyt wiele przekierowań');
    url = new URL(loc, url);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  if (Number(r.headers.get('content-length') || 0) > MAX_BYTES) throw new Error('plik za duży');
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('plik za duży');
  const mime = sniffMime(buf);
  if (!mime) throw new Error('to nie jest JPEG, PNG ani WebP');
  const img = cleanImage(mime, buf.toString('base64')); // bez EXIF (zdjęcia z aparatów mają w nim m.in. GPS)
  if (img.error) throw new Error(img.error);
  return img;
}

export async function importPhotos(manifest, fetchFn = fetch) {
  await ensureDb();
  const q = sql();
  const photos = manifest.photos || [];
  const usable = photos.filter(importable);
  const res = { candidates: usable.length, general: photos.filter((p) => p.depicts === 'poglądowe').length, withoutPhoto: 0, assigned: 0, failed: [] };
  const strains = await q`SELECT s.id, s.name FROM strains s WHERE NOT EXISTS (SELECT 1 FROM strain_photos p WHERE p.strain_id = s.id) ORDER BY s.id`;
  res.withoutPhoto = strains.length;
  const cache = new Map();
  for (const s of strains) {
    const photo = usable.find((p) => norm(p.strain) === norm(s.name));
    if (!photo) continue;
    try {
      if (!cache.has(photo.id)) cache.set(photo.id, await download(photo, fetchFn));
      const { mime, b64 } = cache.get(photo.id);
      const path = await putPhoto(mime, b64);
      try {
        const rows = await q`INSERT INTO strain_photos (strain_id, mime, data, uploaded_by, blob_path, credit, license, license_url, source_url)
          VALUES (${s.id}, ${mime}, ${path ? '' : b64}, NULL, ${path}::text, ${String(photo.author).slice(0, 200)}, ${String(photo.license).slice(0, 40)},
                  ${httpsUrl(photo.licenseUrl)}, ${httpsUrl(photo.sourcePage)})
          ON CONFLICT (strain_id) DO NOTHING RETURNING strain_id`;
        if (rows.length) res.assigned++; else await deletePhotos(path);
      } catch (e) { await deletePhotos(path); throw e; }
    } catch (e) {
      res.failed.push(`${s.name}: ${e?.message || e}`);
    }
  }
  return res;
}
