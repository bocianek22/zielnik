// Najmniejsze poprawne pliki zdjęć do testów (trasy sprawdzają zawartość i usuwają metadane, lib/image-meta.js).
// `tag` trafia do fragmentu, który czyszczenie zostawia, więc różne tagi = różne pliki, a plik po zapisie jest identyczny.
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
};
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const IHDR = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);

// PNG: IHDR, prywatny fragment z tagiem, (opcjonalnie metadane), IDAT, IEND
export function pngBytes(tag = 'x', { meta = false } = {}) {
  return Buffer.concat([PNG_SIG, chunk('IHDR', IHDR), chunk('prVt', Buffer.from(String(tag))),
    ...(meta ? [chunk('tEXt', Buffer.from('GPS\u000050.06,19.94')), chunk('eXIf', Buffer.from('MM\u0000*GPS'))] : []),
    chunk('IDAT', Buffer.from([0x78, 0x9c, 0x63, 0, 0, 0, 2, 0, 1])), chunk('IEND', Buffer.alloc(0))]);
}

const seg = (marker, data) => {
  const h = Buffer.from([0xff, marker, 0, 0]); h.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([h, data]);
};
// JPEG: APP0 (JFIF), DQT z tagiem, (opcjonalnie APP1 EXIF i COM), SOS z danymi, EOI
export function jpegBytes(tag = 'x', { meta = false } = {}) {
  return Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, Buffer.from('JFIF\u0000\u0001\u0001')),
    ...(meta ? [seg(0xe1, Buffer.from('Exif\u0000\u0000GPSLatitude 50.06')), seg(0xfe, Buffer.from('komentarz'))] : []),
    seg(0xdb, Buffer.from(String(tag))), seg(0xda, Buffer.from([1, 1, 0, 0, 63, 0])), Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56]),
    Buffer.from([0xff, 0xd9])]);
}

export const png = (tag, o) => `data:image/png;base64,${pngBytes(tag, o).toString('base64')}`;
export const jpeg = (tag, o) => `data:image/jpeg;base64,${jpegBytes(tag, o).toString('base64')}`;
