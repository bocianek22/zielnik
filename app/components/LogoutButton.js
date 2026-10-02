'use client';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

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

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn ghost small on-dark"
      onClick={async () => {
        const pushEndpoint = await dropPush();
        await api('/api/auth/logout', 'POST', pushEndpoint ? { pushEndpoint } : undefined);
        router.replace('/login');
        router.refresh();
      }}
    >
      Wyloguj
    </button>
  );
}
