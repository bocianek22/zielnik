// Dane tego urządzenia, które po wylogowaniu nie powinny zostać dla następnej osoby (wspólny telefon lub komputer):
// ostatnie wyszukiwania (nazwy odmian), data wizyty u lekarza, data ostatniej kopii danych, token FCM i znaczniki push.
// Zostają ustawienia urządzenia: motyw, tryb dyskretny, blokada aplikacji.
export const PRIVATE_KEYS = ['zielnik.szukaj.ostatnie', 'zielnik.odmiany.ostatnie', 'zielnik.lastVisit', 'zielnik.lastBackup',
  'zielnik.fcmToken', 'zielnik.fcmSync', 'zielnik.pushSync'];

export function clearDeviceData() {
  try { for (const k of PRIVATE_KEYS) localStorage.removeItem(k); } catch {}
  try { sessionStorage.clear(); } catch {}
}
