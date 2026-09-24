'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function FriendButton({ userId, status }) {
  const router = useRouter();
  const [err, setErr] = useState('');
  async function act(action) {
    try { await api('/api/friends', 'POST', { action, userId }); router.refresh(); } catch (e) { setErr(e.message); }
  }
  return (
    <div className="row">
      {status === 'none' && <button className="btn small" onClick={() => act('request')}>Dodaj do znajomych</button>}
      {status === 'outgoing' && <button className="btn ghost small" onClick={() => act('remove')}>Cofnij zaproszenie</button>}
      {status === 'incoming' && <><button className="btn small" onClick={() => act('accept')}>Akceptuj zaproszenie</button>
        <button className="btn ghost small" onClick={() => act('remove')}>Odrzuć</button></>}
      {status === 'friends' && <button className="btn ghost small" onClick={() => confirm('Usunąć ze znajomych?') && act('remove')}>Usuń ze znajomych</button>}
      {err && <span className="field-err">{err}</span>}
    </div>
  );
}
