// Lokalne przypomnienia w APK (POM-49): harmonogram liczony na telefonie, bez serwera, kluczy push i crona co godzinę.
// Czysty moduł (bez importów): przeglądarka, testy. Treści neutralne (tryb dyskretny: powiadomienie widać na ekranie blokady).
export const LOCAL_HOURS = [19, 20, 21, 22];
export const DAYS_AHEAD = 7;
export const ID_BASE = { symptoms: 4900, visit: 4990 };
export const ALL_IDS = [...Array.from({ length: DAYS_AHEAD + 1 }, (_, i) => ID_BASE.symptoms + i), ID_BASE.visit];
const VISIT_HOUR = 18; // dzień przed wizytą, o 18:00

const PL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const parts = (d) => Object.fromEntries(PL.formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
export const dayPL = (d) => { const p = parts(d); return `${p.year}-${p.month}-${p.day}`; };
const addDays = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

// Chwila „dzień, godzina:00 w Warszawie” (zmiana czasu: przesunięcie liczone dla tej chwili, dwie iteracje wystarczają)
export function warsawAt(dayIso, hour) {
  const [y, m, d] = dayIso.split('-').map(Number);
  let t = Date.UTC(y, m - 1, d, hour);
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(t));
    const shown = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    t -= shown - Date.UTC(y, m - 1, d, hour);
  }
  return new Date(t);
}

// settings: { symptoms: bool, hour: 19-22, visit: bool }; hasToday: dziś jest już wpis objawów; nextVisit: 'RRRR-MM-DD' | null
// Zwraca [{ id, at: Date, title, body, url }] tylko z przyszłości.
export function planLocal({ now = new Date(), settings = {}, hasToday = false, nextVisit = null }) {
  const out = [];
  const today = dayPL(now);
  const hour = LOCAL_HOURS.includes(settings.hour) ? settings.hour : 21;
  if (settings.symptoms) {
    for (let i = 0; i <= DAYS_AHEAD; i++) {
      if (i === 0 && hasToday) continue;
      const at = warsawAt(addDays(today, i), hour);
      if (at > now) out.push({ id: ID_BASE.symptoms + i, at, title: 'Przypomnienie', body: 'Masz wpis do uzupełnienia.', url: '/#objawy' });
    }
  }
  if (settings.visit && nextVisit && /^\d{4}-\d{2}-\d{2}$/.test(nextVisit)) {
    const at = warsawAt(addDays(nextVisit, -1), VISIT_HOUR);
    if (at > now) out.push({ id: ID_BASE.visit, at, title: 'Przypomnienie', body: 'Jutro masz zaplanowaną wizytę.', url: '/raport' });
  }
  return out;
}

// Ustawienia z Preferences (napis JSON) z domyślnymi wartościami; wszystko wyłączone, dopóki użytkownik nie włączy
export function parseLocalSettings(raw) {
  let v = {};
  try { v = JSON.parse(raw || '{}') || {}; } catch { v = {}; }
  return { symptoms: v.symptoms === true, hour: LOCAL_HOURS.includes(v.hour) ? v.hour : 21, visit: v.visit === true };
}
