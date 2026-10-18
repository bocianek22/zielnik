// UI 5 etap 5: odznaki za porządek (decyzja właściciela w docs/UI-5.md). Liczone wyłącznie z danych na serwerze
// (seria wpisów objawów, recepty, wizyty), więc są takie same na każdym urządzeniu. Nigdy za zużycie ani za „dobre”
// wartości objawów: nagradzamy regularne zapisywanie, nie wynik (inaczej kusiłoby zaniżanie wpisów).
// Nazwy i opisy bez słów zdradzających temat aplikacji (tryb dyskretny). Nieodblokowane wyglądają neutralnie, bez wyrzutów.
export const BADGES = [
  { key: 'first', label: 'Pierwszy wpis', how: 'Zapisz objawy pierwszego dnia', icon: 'edit', ok: (s) => s.total >= 1 },
  { key: 'week', label: 'Tydzień z rzędu', how: 'Wpisy przez 7 dni z rzędu', icon: 'calendar', ok: (s) => s.best >= 7 },
  { key: 'days30', label: '30 dni wpisów', how: 'Wpisy w 30 różnych dniach', icon: 'book', ok: (s) => s.total >= 30 },
  { key: 'month', label: 'Miesiąc z rzędu', how: 'Wpisy przez 30 dni z rzędu', icon: 'zap', ok: (s) => s.best >= 30 },
  { key: 'docs', label: 'Dokumenty w porządku', how: 'Dodaj pierwszą receptę', icon: 'file', ok: (s) => s.rx >= 1 },
  { key: 'visit', label: 'Wizyta zapisana', how: 'Zapisz wizytę w dzienniku wizyt', icon: 'clipboard', ok: (s) => s.visits >= 1 },
];

// s: { best, total, rx, visits } -> lista { key, label, how, icon, on }
export function badgesOf(s) {
  const v = { best: 0, total: 0, rx: 0, visits: 0, ...s };
  return BADGES.map(({ ok, ...b }) => ({ ...b, on: !!ok(v) }));
}

// „Już pokazane” odznaki są w localStorage (BADGES_SEEN_KEY). Pierwsze odczytanie (brak zapisu) zapamiętuje wszystkie
// zdobyte po cichu, żeby po wydaniu nie wyskoczyło kilka gratulacji naraz. Zwraca { fresh: klucze do pokazania, seen }.
export const BADGES_SEEN_KEY = 'zielnik.badges';
export function newBadges(earned, stored) {
  if (stored == null) return { fresh: [], seen: [...earned] };
  const prev = new Set(String(stored).split(',').filter(Boolean));
  const fresh = earned.filter((k) => !prev.has(k));
  return { fresh, seen: [...new Set([...prev, ...earned])] };
}
