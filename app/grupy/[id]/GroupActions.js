'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

// part="invite": zaproszenie znajomego. part="leave": opuszczenie i usunięcie grupy. kickId: działania na członku
// (SPO-3): właściciel nadaje i odbiera moderatora, przekazuje grupę i usuwa; moderator usuwa tylko zwykłych członków.
export default function GroupActions({ groupId, isOwner, kickId, kickName = 'członka', memberRole, viewerRole, part = 'invite' }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [msg, setMsg] = useState('');
  async function act(body, after) {
    try { await api(`/api/groups/${groupId}`, 'POST', body); setMsg(''); after ? after() : router.refresh(); }
    catch (e) { setMsg(e.message); }
  }
  if (kickId) {
    const owner = viewerRole === 'owner';
    return (
      <>
        {owner && memberRole !== 'invited' && (memberRole === 'moderator'
          ? <button className="btn text small" aria-label={`Odbierz rolę moderatora: ${kickName}`} onClick={() => act({ action: 'unmod', userId: kickId })}>Odbierz moderatora</button>
          : <button className="btn text small" aria-label={`Nadaj rolę moderatora: ${kickName}`} onClick={() => act({ action: 'mod', userId: kickId })}>Nadaj moderatora</button>)}
        {owner && memberRole !== 'invited' && <button className="btn text small" aria-label={`Przekaż własność grupy: ${kickName}`}
          onClick={() => confirm(`Przekazać grupę użytkownikowi ${kickName}? Zostaniesz zwykłym członkiem i nie cofniesz tego sam.`) && act({ action: 'transfer', userId: kickId })}>Przekaż grupę</button>}
        <button className="btn text small" aria-label={`Usuń z grupy: ${kickName}`} onClick={() => confirm('Usunąć z grupy?') && act({ action: 'kick', userId: kickId })}>Usuń</button>
        {msg && <p className="field-err person-err" role="alert">{msg}</p>}
      </>
    );
  }
  if (part === 'leave') {
    return (
      <div className="group-leave">
        <div className="row">
          <button className="btn ghost" onClick={() => confirm('Opuścić grupę?') && act({ action: 'leave' }, () => router.replace('/grupy'))}>Opuść grupę</button>
          {isOwner && <button className="btn danger" onClick={() => confirm('Usunąć grupę?') && act({ action: 'delete' }, () => router.replace('/grupy'))}>Usuń grupę</button>}
        </div>
        {msg && <p className="field-err" role="alert">{msg}</p>}
      </div>
    );
  }
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); act({ action: 'invite', username }, () => { setUsername(''); setMsg('Zaproszenie wysłane.'); router.refresh(); }); }}>
      <div className="field"><label htmlFor="g-invite">Nick znajomego</label>
        <div className="search-row">
          <input id="g-invite" className="input" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="off" autoCapitalize="none" />
          <button className="btn">Zaproś</button>
        </div>
        {msg && (msg === 'Zaproszenie wysłane.' ? <p className="muted small" role="status">{msg}</p> : <p className="field-err" role="alert">{msg}</p>)}
      </div>
    </form>
  );
}
