'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

// Bez kickId: zaproszenie, opuszczenie i usunięcie grupy. Z kickId: przycisk usunięcia członka.
export default function GroupActions({ groupId, isOwner, kickId }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [msg, setMsg] = useState('');
  async function act(body, after) {
    try { await api(`/api/groups/${groupId}`, 'POST', body); setMsg(''); after ? after() : router.refresh(); }
    catch (e) { setMsg(e.message); }
  }
  if (kickId) return <button className="btn ghost small" onClick={() => confirm('Usunąć z grupy?') && act({ action: 'kick', userId: kickId })}>Usuń</button>;
  return (
    <div className="stack">
      <form className="row" onSubmit={(e) => { e.preventDefault(); act({ action: 'invite', username }, () => { setUsername(''); setMsg('Zaproszenie wysłane.'); router.refresh(); }); }}>
        <input className="input" placeholder="Nick znajomego" aria-label="Nick znajomego" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <button className="btn small">Zaproś</button>
      </form>
      <div className="row">
        <button className="btn ghost small" onClick={() => confirm('Opuścić grupę?') && act({ action: 'leave' }, () => router.replace('/grupy'))}>Opuść grupę</button>
        {isOwner && <button className="btn danger small" onClick={() => confirm('Usunąć grupę?') && act({ action: 'delete' }, () => router.replace('/grupy'))}>Usuń grupę</button>}
      </div>
      {msg && <span className="muted" role="status">{msg}</span>}
    </div>
  );
}
