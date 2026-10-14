// „Rok objawów” (POM-50): stała skala 0–10 w czterech poziomach jednej barwy (--seq-1…4). Bez znaczenia „dobrze/źle”:
// przy bólu wyżej to więcej bólu, przy śnie lepszy sen; kolor mówi tylko o wartości liczby.
export const LEVELS = [[0, 2], [3, 5], [6, 8], [9, 10]];
export const symptomLevel = (v) => (v == null ? 0 : v <= 2 ? 1 : v <= 5 ? 2 : v <= 8 ? 3 : 4);
