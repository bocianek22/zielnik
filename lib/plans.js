// Plany i funkcje płatne. Dopóki PREMIUM_ENFORCED nie ma wartości "1", wszystko jest darmowe;
// włączenie płatności wymaga tylko ustawienia tej zmiennej i podpięcia bramki płatności.
export const FEATURES = {
  doctor_report: 'premium', // raport dla lekarza
  reminders: 'premium',     // przypomnienia (w przyszłości)
  extra_photos: 'premium',  // więcej zdjęć (w przyszłości)
};

export function canUse(planRow, feature) {
  if (process.env.PREMIUM_ENFORCED !== '1') return true;
  if (FEATURES[feature] !== 'premium') return true;
  const until = planRow?.plan_until ? new Date(planRow.plan_until) : null;
  return planRow?.plan === 'premium' && (!until || until > new Date());
}

// Opisy do strony "Premium i wsparcie"
export const PLAN_FEATURES = [
  ['Dziennik odmian, oceny, opinie, zdjęcia i testy', 'free'],
  ['Zużycie, zakupy, wspólna pula recepty, prognoza zapasu', 'free'],
  ['Znajomi, grupy, rankingi, koło fortuny, katalog i wiedza', 'free'],
  ['Eksport danych i własne kopie (CSV, JSON)', 'free'],
  ['Raport dla lekarza (PDF do druku)', 'premium'],
  ['Przypomnienia o wykupie i terminach (w przygotowaniu)', 'premium'],
  ['Więcej zdjęć przy odmianach i testach (w przygotowaniu)', 'premium'],
];
