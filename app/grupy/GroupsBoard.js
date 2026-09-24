'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function GroupsBoard() {
  const [groups, setGroups] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api('/api/groups').then((r) => setGroups(r.groups)).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    try { setGroups((await api('/api/groups', 'POST', { name, description })).groups); setName(''); setDescription(''); setMsg(''); }
    catch (err) { setMsg(err.message); }
  }
  async function act(id, action) {
    try { await api(`/api/groups/${id}`, 'POST', { action }); await load(); } catch (err) { setMsg(err.message); }
  }

  const invites = (groups || []).filter((g) => g.status === 'invited');
  const mine = (groups || []).filter((g) => g.status === 'active');
  return (
    <div className="stack">
      {msg && <div className="alert error" role="alert">{msg}</div>}
      {invites.length > 0 && (
        <section className="card"><h2>Zaproszenia do grup</h2>
          <ul className="people">{invites.map((g) => (
            <li key={g.id} className="person"><b>{g.name}</b>
              <span className="row"><button className="btn small" onClick={() => act(g.id, 'accept')}>Dołącz</button>
                <button className="btn ghost small" onClick={() => act(g.id, 'leave')}>Odrzuć</button></span></li>))}</ul></section>
      )}
      <section className="card"><h2>Twoje grupy</h2>
        {groups === null ? <p className="muted">Ładuję…</p> : mine.length === 0 ? <p className="muted">Nie należysz jeszcze do żadnej grupy.</p> : (
          <ul className="people">{mine.map((g) => (
            <li key={g.id} className="person"><Link href={`/grupy/${g.id}`}><b>{g.name}</b> <span className="muted">{g.members} os.</span></Link>
              {g.role === 'owner' && <span className="badge">Właściciel</span>}</li>))}</ul>)}
      </section>
      <form className="card stack" onSubmit={create}>
        <h2>Nowa grupa</h2>
        <div className="field"><label htmlFor="g-name">Nazwa</label>
          <input id="g-name" className="input" maxLength={60} required minLength={3} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="g-desc">Opis (opcjonalnie)</label>
          <input id="g-desc" className="input" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div><button className="btn">Utwórz grupę</button></div>
      </form>
    </div>
  );
}
