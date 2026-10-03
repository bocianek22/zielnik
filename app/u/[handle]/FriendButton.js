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
    <>
      {status === 'none' && <button className="btn" onClick={() => act('request')}>Dodaj do znajomych</button>}
      {status === 'outgoing' && <><span className="muted profile-state">Zaproszenie wysłane</span>
        <button className="btn text" onClick={() => act('remove')}>Cofnij</button></>}
      {status === 'incoming' && <><button className="btn" onClick={() => act('accept')}>Akceptuj zaproszenie</button>
        <button className="btn text" onClick={() => act('remove')}>Odrzuć</button></>}
      {status === 'friends' && <button className="btn text" onClick={() => confirm('Usunąć ze znajomych?') && act('remove')}>Usuń ze znajomych</button>}
      {err && <span className="field-err" role="alert">{err}</span>}
    </>
  );
}
