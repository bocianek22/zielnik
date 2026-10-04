// Serwerowe czyszczenie zdjęć przed zapisem: zgodność zawartości z typem i usunięcie metadanych (EXIF z GPS, XMP,
// IPTC, komentarze, daty). Przeglądarka i tak przekodowuje zdjęcia przez canvas (lib/image.js), ale API przyjmuje
// dane od dowolnego klienta, a zdjęcie testu widzą znajomi. Pikseli nie zmieniamy.

export function sniffMime(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a) return 'image/png';
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// JPEG: kopiujemy segmenty do początku skanu (SOS), potem resztę bez zmian. Zostają APP0 (JFIF), APP2 (profil ICC)
// i APP14 (Adobe, potrzebny do kolorów CMYK); znikają APP1 (EXIF, XMP), pozostałe APPn i komentarze (COM).
const JPEG_KEEP_APP = new Set([0xe0, 0xe2, 0xee]);
function stripJpeg(b) {
  const out = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    let m = b[i + 1];
    while (m === 0xff && i + 2 < b.length) { i++; m = b[i + 1]; } // bajty wypełnienia
    if (m === undefined) return null;
    if (m === 0xd9) { out.push(b.subarray(i, i + 2)); return Buffer.concat(out); }
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) { out.push(b.subarray(i, i + 2)); i += 2; continue; }
    if (i + 4 > b.length) return null;
    const len = b.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > b.length) return null;
    if (m === 0xda) { out.push(b.subarray(i)); return Buffer.concat(out); }
    const drop = m === 0xfe || (m >= 0xe0 && m <= 0xef && !JPEG_KEEP_APP.has(m));
    if (!drop) out.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null;
}

// PNG: bez fragmentów z tekstem, EXIF i czasem; reszta (w tym CRC) bez zmian
const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
function stripPng(b) {
  const out = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = b.readUInt32BE(i);
    const type = b.toString('latin1', i + 4, i + 8);
    const end = i + 12 + len;
    if (end > b.length) return null;
    if (!PNG_DROP.has(type)) out.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') return Buffer.concat(out);
  }
  return null;
}

// WebP: bez fragmentów EXIF i XMP, flagi w VP8X wyzerowane, rozmiar RIFF przeliczony
function stripWebp(b) {
  const out = [Buffer.from(b.subarray(0, 12))];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = b.toString('latin1', i, i + 4);
    const len = b.readUInt32LE(i + 4);
    const end = i + 8 + len + (len & 1);
    if (i + 8 + len > b.length) return null;
    if (type === 'VP8X') {
      const c = Buffer.from(b.subarray(i, Math.min(end, b.length)));
      if (c.length > 8) c[8] &= ~0x0c; // bity EXIF (0x08) i XMP (0x04)
      out.push(c);
    } else if (type !== 'EXIF' && type !== 'XMP ') out.push(b.subarray(i, Math.min(end, b.length)));
    i = end;
  }
  const res = Buffer.concat(out);
  res.writeUInt32LE(res.length - 8, 4);
  return res;
}

// Zwraca { mime, b64 } z oczyszczonym zdjęciem albo { error }, gdy zawartość nie pasuje do typu lub plik jest uszkodzony
export function cleanImage(mime, b64) {
  const buf = Buffer.from(String(b64 || ''), 'base64');
  if (sniffMime(buf) !== mime) return { error: 'Plik nie jest zdjęciem JPEG, PNG lub WebP.' };
  const clean = mime === 'image/jpeg' ? stripJpeg(buf) : mime === 'image/png' ? stripPng(buf) : stripWebp(buf);
  if (!clean) return { error: 'Nie można odczytać tego zdjęcia.' };
  return { mime, b64: clean.toString('base64') };
}

// Wariant dla adresu data: (awatar): zwraca oczyszczony data URL albo null
export function cleanDataUrl(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const c = cleanImage(m[1], m[2]);
  return c.error ? null : `data:${c.mime};base64,${c.b64}`;
}
