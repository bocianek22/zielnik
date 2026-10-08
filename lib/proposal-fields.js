// Etykiety i formatowanie pól wspólnych odmiany w propozycjach zmian (klucze jak w strain_edits / EDIT_FIELDS).
export const FIELD_LABELS = {
  producer: 'Producent', name: 'Odmiana', type: 'Typ', kind: 'Rodzaj', form: 'Postać', thc: 'THC (%)', cbd: 'CBD (%)',
  terpenes: 'Terpeny', taste: 'Smak', price_per_g: 'Cena (zł)', batch: 'Numer serii', expires_on: 'Ważne do',
  final_rating: 'Ocena końcowa', description: 'Opis', sources: 'Źródła', description_auto: 'Opis z internetu',
};
export const FIELD_ORDER = Object.keys(FIELD_LABELS);

// Wartość pola do pokazania w różnicy przed/po
export function showValue(field, v) {
  if (v === null || v === undefined || v === '') return '(puste)';
  if (field === 'terpenes') return v.length ? v.join(', ') : '(puste)';
  if (field === 'sources') return v.length ? v.map((s) => s.title || s.url).join(', ') : '(puste)';
  if (field === 'description_auto') return v ? 'tak' : 'nie';
  return String(v);
}

// Zmiany propozycji w stałej kolejności pól: [{ field, label, before, after }]
export function orderedChanges(changes) {
  return Object.keys(changes || {}).sort((a, b) => FIELD_ORDER.indexOf(a) - FIELD_ORDER.indexOf(b))
    .map((field) => ({ field, label: FIELD_LABELS[field] || field, before: changes[field][0], after: changes[field][1] }));
}

export const STATUS_LABELS = { oczekuje: 'czeka na akceptację', przyjeta: 'przyjęta', odrzucona: 'odrzucona' };
