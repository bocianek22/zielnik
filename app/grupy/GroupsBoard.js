'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import useNativeRefresh from '@/app/components/native/useNativeRefresh';
import Icon from '@/app/components/Icon';
import osob from './osob';

export default function GroupsBoard() {
  const [groups, setGroups] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api('/api/groups').then((r) => setGroups(r.groups)).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);
  useNativeRefresh(load);

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
    <div className="social">
      {msg && <div className="alert error" role="alert">{msg}</div>}
      {invites.length > 0 && (
        <>
          <h2 className="section-label">Zaproszenia do grup ({invites.length})</h2>
          <ul className="list">{invites.map((g) => (
            <li key={g.id} className="list-row person-row">
              <Icon name="group" />
              <span className="lr-main person-link"><span className="person-name">{g.name}</span>{g.members != null && <span className="lr-sub">{osob(g.members)}</span>}</span>
              <span className="person-actions">
                <button className="btn small" onClick={() => act(g.id, 'accept')}>Dołącz</button>
                <button className="btn text small" onClick={() => act(g.id, 'leave')}>Odrzuć</button>
              </span>
            </li>))}</ul>
        </>
      )}

      <h2 className="section-label">Twoje grupy</h2>
      {groups === null ? <p className="muted social-note">Ładuję…</p> : mine.length === 0 ? (
        <div className="empty card">
          <Icon name="group" size={32} />
          <h2>Nie należysz do żadnej grupy</h2>
          <p>W grupie porównujesz oceny ze znajomymi i widzisz wspólny ranking odmian.</p>
          <a className="btn ghost" href="#nowa-grupa">Utwórz grupę</a>
        </div>
      ) : (
        <ul className="list">{mine.map((g) => (
          <li key={g.id}>
            <Link href={`/grupy/${g.id}`} className="list-row">
              <Icon name="group" />
              <span className="lr-main person-link"><span className="person-name">{g.name}</span><span className="lr-sub">{osob(g.members)}{g.role === 'owner' ? ' · Właściciel' : ''}</span></span>
              {g.unread > 0 && <span className="nbadge" aria-label={`Nieprzeczytane wiadomości: ${g.unread}${g.unread >= 100 ? ' lub więcej' : ''}`}>{g.unread >= 100 ? '99+' : g.unread}</span>}
              <Icon name="chevronRight" size={20} className="lr-chev" />
            </Link>
          </li>))}</ul>)}

      <h2 className="section-label" id="nowa-grupa">Nowa grupa</h2>
      <form className="card stack" onSubmit={create}>
        <div className="field"><label htmlFor="g-name">Nazwa</label>
          <input id="g-name" className="input" maxLength={60} required minLength={3} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="g-desc">Opis (opcjonalnie)</label>
          <input id="g-desc" className="input" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div><button className="btn block">Utwórz grupę</button></div>
      </form>
    </div>
  );
}
