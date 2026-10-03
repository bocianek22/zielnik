import { ensureDb, sql } from './db';
import { putPhoto, deletePhotos } from './photos';

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

function mimeOf(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

async function download(photo, fetchFn) {
  const url = new URL(photo.thumbUrl || photo.fileUrl);
  if (url.protocol !== 'https:' || !HOSTS.has(url.hostname)) throw new Error('niedozwolony host');
  const r = await fetchFn(url.href, { headers: { 'User-Agent': IMPORT_UA }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('plik za duży');
  const mime = mimeOf(buf);
  if (!mime) throw new Error('to nie jest JPEG, PNG ani WebP');
  return { mime, b64: buf.toString('base64') };
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
                  ${photo.licenseUrl || null}, ${photo.sourcePage || null})
          ON CONFLICT (strain_id) DO NOTHING RETURNING strain_id`;
        if (rows.length) res.assigned++; else await deletePhotos(path);
      } catch (e) { await deletePhotos(path); throw e; }
    } catch (e) {
      res.failed.push(`${s.name}: ${e?.message || e}`);
    }
  }
  return res;
}
