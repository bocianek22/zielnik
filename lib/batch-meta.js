// POM-32: notatka o partii przy zakupie. Część bez zależności (działa też w przeglądarce): stałe, etykiety, sprawdzanie dnia.
// Ocena „jak działała w porównaniu do zwykle” jest neutralnym opisem własnych odczuć, nie zaleceniem.
export const BATCH_EFFECTS = { weaker: 'słabiej', usual: 'jak zwykle', stronger: 'mocniej' };
export const BATCH_NO_MAX = 40;
export const BATCH_NOTE_MAX = 500;
export const batchEffectLabel = (k) => BATCH_EFFECTS[k] ?? null;

// Dzień RRRR-MM-DD z kalendarza (2027-02-30 odpada), od 2000 do 2100
export function validBatchDay(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v && v >= '2000-01-01' && v <= '2100-12-31';
}

// Czy zakup ma jakąkolwiek informację o partii
export const hasBatch = (r) => !!(r.batchNo || r.batchExpires || r.batchEffect || r.batchNote || r.batchNoteLocked);

// Jedna linia opisu partii (CSV, raport): „Partia A12; ważna do 2027-01-10; działanie: słabiej niż zwykle”
export function batchSummary(r) {
  const parts = [];
  if (r.batchNo) parts.push(`Partia ${r.batchNo}`);
  if (r.batchExpires) parts.push(`ważna do ${r.batchExpires}`);
  if (r.batchEffect && BATCH_EFFECTS[r.batchEffect]) parts.push(`działanie: ${BATCH_EFFECTS[r.batchEffect]}${r.batchEffect === 'usual' ? '' : ' niż zwykle'}`);
  if (r.batchNote) parts.push(r.batchNote);
  return parts.join('; ');
}
