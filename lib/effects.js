// Skala odczuć (0–10) używana w podstronie odmiany i na wykresie
export const EFFECTS = [
  ['relax', 'Relaks'],
  ['energy', 'Energia'],
  ['sleep', 'Sen'],
  ['pain', 'Ulga w bólu'],
  ['appetite', 'Apetyt'],
];

// Opisy pomagające wystawiać oceny odczuć (skala 0-10)
export const EFFECT_HELP = {
  relax: 'Odprężenie, spokój, rozluźnienie napięcia w ciele i głowie. 0 = brak, 10 = bardzo silne odprężenie.',
  energy: 'Pobudzenie, chęć do działania, lekkość i łatwiejsze skupienie. 0 = brak, 10 = wyraźne pobudzenie.',
  sleep: 'Senność i pomoc w zasypianiu lub przespaniu nocy. 0 = brak, 10 = silnie usypia.',
  pain: 'Zmniejszenie odczuwanego bólu lub dyskomfortu. 0 = brak ulgi, 10 = bardzo duża ulga.',
  appetite: 'Wzrost apetytu i chęci do jedzenia. 0 = brak, 10 = bardzo silny apetyt.',
};

// Tagi efektów tworzone automatycznie ze średnich ocen odczuć widocznych dla oglądającego
export const EFFECT_TAGS = { relax: 'relaks', energy: 'energia', sleep: 'na sen', pain: 'na ból', appetite: 'apetyt' };
export const TAG_LIST = Object.values(EFFECT_TAGS);
export const TAG_THRESHOLD = 6.5;

export function strainTags(strain) {
  const tags = [];
  for (const [k] of EFFECTS) {
    const v = (strain.entries || []).map((e) => e.effects?.[k]).filter((x) => x != null);
    if (v.length && v.reduce((a, b) => a + b, 0) / v.length >= TAG_THRESHOLD) tags.push(EFFECT_TAGS[k]);
  }
  return tags;
}
