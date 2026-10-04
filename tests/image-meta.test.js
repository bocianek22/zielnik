// Czyszczenie zdjęć z metadanych (lib/image-meta.js): EXIF z GPS nie może trafić do bazy ani do znajomych
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanImage, cleanDataUrl, sniffMime } from '../lib/image-meta.js';
import { pngBytes, jpegBytes } from './db/images.mjs';

const b64 = (b) => b.toString('base64');
const out = (r) => Buffer.from(r.b64, 'base64');

test('JPEG: APP1 (EXIF/GPS) i komentarz usunięte, APP0, tablice i skan bez zmian', () => {
  const r = cleanImage('image/jpeg', b64(jpegBytes('t', { meta: true })));
  assert.ok(!r.error, r.error);
  const o = out(r);
  assert.ok(!o.includes('GPSLatitude') && !o.includes('Exif') && !o.includes('komentarz'));
  assert.deepEqual(o, jpegBytes('t'), 'wynik = ten sam plik bez metadanych');
  assert.deepEqual(out(cleanImage('image/jpeg', b64(jpegBytes('t')))), jpegBytes('t'), 'czysty plik bez zmian');
});

test('PNG: tEXt i eXIf usunięte, reszta bajt w bajt', () => {
  const r = cleanImage('image/png', b64(pngBytes('t', { meta: true })));
  assert.ok(!r.error, r.error);
  assert.ok(!out(r).includes('GPS'));
  assert.deepEqual(out(r), pngBytes('t'));
});

test('WebP: fragmenty EXIF/XMP usunięte, flagi VP8X wyzerowane, rozmiar RIFF poprawny', () => {
  const ch = (t, d) => { const h = Buffer.alloc(8); h.write(t, 0, 'latin1'); h.writeUInt32LE(d.length, 4); return Buffer.concat([h, d, d.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]); };
  const body = Buffer.concat([ch('VP8X', Buffer.from([0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0])), ch('VP8 ', Buffer.from('dane')), ch('EXIF', Buffer.from('GPS 50.06')), ch('XMP ', Buffer.from('<x>'))]);
  const head = Buffer.alloc(12); head.write('RIFF', 0, 'latin1'); head.writeUInt32LE(body.length + 4, 4); head.write('WEBP', 8, 'latin1');
  const r = cleanImage('image/webp', b64(Buffer.concat([head, body])));
  assert.ok(!r.error, r.error);
  const o = out(r);
  assert.ok(!o.includes('GPS') && !o.includes('XMP '));
  assert.equal(o.readUInt32LE(4), o.length - 8);
  assert.equal(o[20] & 0x0c, 0);
  assert.ok(o.includes('dane'));
});

test('zawartość niezgodna z typem albo uszkodzona jest odrzucana', () => {
  assert.match(cleanImage('image/png', b64(jpegBytes('t'))).error, /nie jest/);
  assert.match(cleanImage('image/jpeg', b64(Buffer.from('<html><script>alert(1)</script>'))).error, /nie jest/);
  assert.match(cleanImage('image/png', b64(pngBytes('t').subarray(0, 30))).error, /odczytać/);
  assert.match(cleanImage('image/jpeg', b64(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01]))).error, /odczytać/);
  assert.equal(sniffMime(Buffer.from('GIF89a')), null);
});

test('awatar (data URL): czysty wynik albo null', () => {
  const d = `data:image/png;base64,${b64(pngBytes('a', { meta: true }))}`;
  assert.equal(cleanDataUrl(d), `data:image/png;base64,${b64(pngBytes('a'))}`);
  assert.equal(cleanDataUrl('data:image/svg+xml;base64,PHN2Zz4='), null);
  assert.equal(cleanDataUrl('data:image/png;base64,iVBORw0KGgo='), null);
});
