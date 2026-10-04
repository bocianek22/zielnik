'use client';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { storedFcm } from './native/bridge';
import { clearDeviceData } from './deviceData';
import { clearQueue, flushQueue, queueState } from '@/lib/offline-client';
import { pendingText } from '@/lib/offline-queue';

// Wylogowanie wyłącza też powiadomienia push na tym urządzeniu (przypomnienia nie powinny trafiać na urządzenie,
// z którego korzysta już ktoś inny). Gdy coś pójdzie nie tak, i tak wylogowujemy.
async function dropPush() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (!sub) return undefined;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    return endpoint;
  } catch { return undefined; }
}

export default function LogoutButton({ className = 'btn ghost small on-dark', children }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        // kolejka offline (dane zdrowotne) nie zostaje na urządzeniu po wylogowaniu: najpierw próba wysłania
        if (queueState().pending > 0) {
          await flushQueue().catch(() => {});
          const n = queueState().pending;
          if (n > 0 && !window.confirm(`${pendingText(n)}. Wylogowanie usunie ${n === 1 ? 'go' : 'je'} z tego urządzenia. Wylogować?`)) return;
        }
        await clearQueue();
        const pushEndpoint = await dropPush();
        // aplikacja natywna: token FCM tego urządzenia też przestaje dostawać przypomnienia tego konta
        const fcmToken = storedFcm() || undefined;
        // ciasteczko sesji (HttpOnly) usuwa tylko serwer: przy błędzie nie udajemy wylogowania
        await api('/api/auth/logout', 'POST', pushEndpoint || fcmToken ? { pushEndpoint, fcmToken } : undefined);
        clearDeviceData();
        router.replace('/login');
        router.refresh();
      }}
    >
      {children || 'Wyloguj'}
    </button>
  );
}
