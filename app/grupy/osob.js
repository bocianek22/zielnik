// „1 osoba”, „3 osoby”, „5 osób”
export default function osob(n) {
  const m10 = n % 10, m100 = n % 100;
  return `${n} ${n === 1 ? 'osoba' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'osoby' : 'osób'}`;
}

// „1 ocena”, „3 oceny”, „5 ocen”
export function ocen(n) {
  const m10 = n % 10, m100 = n % 100;
  return `${n} ${n === 1 ? 'ocena' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? 'oceny' : 'ocen'}`;
}
