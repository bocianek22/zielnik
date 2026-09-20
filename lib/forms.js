// Postać produktu
export const FORMS = [
  ['susz', 'Susz'],
  ['olej', 'Olej'],
  ['pen', 'Pen (wkład)'],
];
export const FORM_VALUES = FORMS.map(([v]) => v);
export const formLabel = (v) => FORMS.find(([k]) => k === v)?.[1] ?? v;
