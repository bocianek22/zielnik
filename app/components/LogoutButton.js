'use client';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn ghost small on-dark"
      onClick={async () => {
        await api('/api/auth/logout', 'POST');
        router.replace('/login');
        router.refresh();
      }}
    >
      Wyloguj
    </button>
  );
}
