// Poziomy widoczności ocen, opinii i testów
export const VIS = [
  ['me', 'Tylko ja'],
  ['friends', 'Znajomi'],
  ['fof', 'Znajomi znajomych'],
  ['all', 'Wszyscy zalogowani'],
];
export const VIS_VALUES = VIS.map(([v]) => v);
export const visLabel = (v) => VIS.find(([k]) => k === v)?.[1] ?? v;
