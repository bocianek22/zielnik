'use client';
import { useEffect } from 'react';

// Raz dziennie ponawia zapis subskrypcji push tego urządzenia: wraca do bazy po odtworzeniu kopii
// (subskrypcji nie kopiujemy), po usunięciu przez serwer albo po zalogowaniu na inne konto.
async function syncPush(reg) {
  if (!('PushManager' in window) || !('Notification' in window) || Notification.permission !== 'granted') return;
  const today = new Date().toISOString().slice(0, 10);
  try { if (localStorage.getItem('zielnik.pushSync') === today) return; } catch {}
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const res = await fetch('/api/push/subscription', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (res.ok) try { localStorage.setItem('zielnik.pushSync', today); } catch {}
}

// Rejestruje service worker (powłoka offline i powiadomienia push, patrz public/sw.js)
export default function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Aplikacja natywna (mobile/) ma własną stronę offline i push FCM; service worker pośredniczyłby tylko w ładowaniu stron
    if (/\bZielnikApp\//.test(navigator.userAgent)) {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }
    navigator.serviceWorker.register('/sw.js').then(syncPush).catch(() => {});
  }, []);
  return null;
}
