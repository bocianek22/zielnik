import { addDaysIso, isIsoDay } from './date.js';

// Plik kalendarza (.ics, RFC 5545) z jednym wydarzeniem całodniowym i przypomnieniem dzień wcześniej o 9:00.
// Tylko stałe teksty z ICS_KINDS (żadnej treści od użytkownika), więc nie ma czego escapować; tryb dyskretny daje
// neutralny tytuł bez słów o aptece czy recepcie.
export const ICS_KINDS = {
  wykup: { title: 'Apteka: wykup', discreet: 'Sprawa do załatwienia', file: 'wykup' },
  recepta: { title: 'Nowa recepta', discreet: 'Sprawa do załatwienia', file: 'recepta' },
  wizyta: { title: 'Wizyta u lekarza', discreet: 'Spotkanie', file: 'wizyta' },
};

const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const compact = (iso) => iso.replaceAll('-', '');

// -> tekst pliku albo null przy złym dniu lub rodzaju
export function buildIcs({ kind, day, discreet = false, now = new Date() }) {
  const k = ICS_KINDS[kind];
  if (!k || !isIsoDay(day)) return null;
  const title = discreet ? k.discreet : k.title;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Notatnik//PL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:ev-${compact(day)}-${now.getTime()}@notatnik`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${compact(day)}`,
    `DTEND;VALUE=DATE:${compact(addDaysIso(day, 1))}`,
    `SUMMARY:${title}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'TRIGGER:-PT15H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
