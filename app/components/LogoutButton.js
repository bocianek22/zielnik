'use client';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { storedFcm } from './native/bridge';
import { clearDeviceData } from './deviceData';

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
        const pushEndpoint = await dropPush();
        // aplikacja natywna: token FCM tego urządzenia też przestaje dostawać przypomnienia tego konta
        const fcmToken = storedFcm() || undefined;
        await api('/api/auth/logout', 'POST', pushEndpoint || fcmToken ? { pushEndpoint, fcmToken } : undefined).catch(() => {});
        clearDeviceData();
        router.replace('/login');
        router.refresh();
      }}
    >
      {children || 'Wyloguj'}
    </button>
  );
}
