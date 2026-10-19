// Lokalne przypomnienia w APK (POM-49): harmonogram liczony na telefonie, bez serwera, kluczy push i crona co godzinę.
// Czysty moduł (bez importów): przeglądarka, testy. Treści neutralne (tryb dyskretny: powiadomienie widać na ekranie blokady).
export const LOCAL_HOURS = [19, 20, 21, 22];
export const DAYS_AHEAD = 7;
export const ID_BASE = { symptoms: 4900, visit: 4990, rx: 4991, stock: 4992, backup: 4993 };
export const ALL_IDS = [...Array.from({ length: DAYS_AHEAD + 1 }, (_, i) => ID_BASE.symptoms + i), ID_BASE.visit, ID_BASE.rx, ID_BASE.stock, ID_BASE.backup];
export const RX_DAYS_BEFORE = 3; // recepta: 3 dni przed końcem ważności
export const STOCK_DAYS_BEFORE = 2; // zapas: 2 dni przed prognozowanym końcem
export const BACKUP_EVERY = 30; // kopia danych (POM-61): 30 dni po ostatniej kopii na tym telefonie
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

// settings: { symptoms, hour: 19-22, visit, rx, stock, backup }; hasToday: dziś jest już wpis objawów; nextVisit: 'RRRR-MM-DD' | null;
// rxUntil: ostatni dzień ważności najbliższej recepty z resztą do wykupienia; stockDays: na ile dni starczy zapasu (prognoza);
// lastBackup: 'RRRR-MM-DD' ostatniej kopii zapisanej na tym telefonie albo null (wtedy liczymy od dziś).
// Zwraca [{ id, at: Date, title, body, url }] tylko z przyszłości. Treści bez nazw, ilości i słów o temacie aplikacji.
export function planLocal({ now = new Date(), settings = {}, hasToday = false, nextVisit = null, rxUntil = null, stockDays = null, lastBackup = null }) {
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
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (settings.rx && rxUntil && iso.test(rxUntil)) {
    const at = warsawAt(addDays(rxUntil, -RX_DAYS_BEFORE), VISIT_HOUR);
    if (at > now) out.push({ id: ID_BASE.rx, at, title: 'Przypomnienie', body: 'Zbliża się termin zapisany w aplikacji.', url: '/recepty' });
  }
  if (settings.stock && Number.isFinite(stockDays) && stockDays >= 0) {
    const at = warsawAt(addDays(today, Math.floor(stockDays) - STOCK_DAYS_BEFORE), VISIT_HOUR);
    if (at > now) out.push({ id: ID_BASE.stock, at, title: 'Przypomnienie', body: 'Sprawdź stan w aplikacji.', url: '/' });
  }
  if (settings.backup) {
    // zaległa kopia: jutro o 18:00 (nie od razu po włączeniu), potem znowu po każdym otwarciu aplikacji
    const due = addDays(lastBackup && iso.test(lastBackup) ? lastBackup : today, BACKUP_EVERY);
    let at = warsawAt(due, VISIT_HOUR);
    if (at <= now) at = warsawAt(addDays(today, 1), VISIT_HOUR);
    out.push({ id: ID_BASE.backup, at, title: 'Przypomnienie', body: 'Czas zapisać kopię danych.', url: '/profil#moje-dane' });
  }
  return out;
}

// Ustawienia z Preferences (napis JSON) z domyślnymi wartościami; wszystko wyłączone, dopóki użytkownik nie włączy
export function parseLocalSettings(raw) {
  let v = {};
  try { v = JSON.parse(raw || '{}') || {}; } catch { v = {}; }
  return { symptoms: v.symptoms === true, hour: LOCAL_HOURS.includes(v.hour) ? v.hour : 21, visit: v.visit === true, rx: v.rx === true, stock: v.stock === true, backup: v.backup === true };
}
