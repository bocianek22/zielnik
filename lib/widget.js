// Widżet Androida „Zapas i Zużyłem” (POM-13, docs/WIDZET-ANDROID.md): czyste funkcje bez DOM.
// Prognoza dni jest jedna dla panelu „Dziś” (TodayPanel) i widżetu, żeby liczby się zgadzały.

// Na ile pełnych dni starczy zapasu przy średnim zużyciu; null, gdy brak zapasu albo zużycia
export const daysLeft = (stock, dailyUse) => (dailyUse > 0 && stock > 0 ? Math.floor(stock / dailyUse) : null);

const addDays = (day, n) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Do widżetu trafia tylko data końca zapasu (minimum z prognoz g i ml); widżet sam odlicza dni.
// stock, dailyUse: { g, ml }; today: dzień „RRRR-MM-DD” z serwera (czas polski)
export function widgetPayload({ stock, dailyUse, today }) {
  const left = ['g', 'ml'].map((u) => daysLeft(Number(stock?.[u]), Number(dailyUse?.[u]))).filter((n) => n != null);
  if (left.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(today || '')) return { until: null };
  return { until: addDays(today, Math.min(...left)) };
}
