// Poziom buźki przy suwaku objawu (UI 5 etap 4): 0 = najgorzej … 4 = najlepiej, null = nie wpisano.
// Kierunek zależy od objawu (lib/symptoms.js, higherBetter): ból i lęk niżej = lepiej, sen i nastrój wyżej = lepiej.
export const faceLevel = (value, higherBetter) => {
  if (value === '' || value == null) return null;
  const good = higherBetter ? Number(value) / 10 : 1 - Number(value) / 10;
  return Math.round(good * 4);
};
