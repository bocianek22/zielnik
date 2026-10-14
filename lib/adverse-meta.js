// Zdarzenia niepożądane (POM-62): stałe wspólne dla serwera i klienta. Nasilenie słowne, bez skali i bez ocen;
// „silne”, nie „ciężkie” (to termin z nadzoru nad bezpieczeństwem leków).
export const ADVERSE_NOTE_MAX = 1000;
export const ADVERSE_MAX = 500;
export const SEVERITIES = [['lagodne', 'łagodne'], ['umiarkowane', 'umiarkowane'], ['silne', 'silne']];
export const severityLabel = (k) => SEVERITIES.find(([v]) => v === k)?.[1] ?? k;
