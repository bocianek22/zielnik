'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import useNativeRefresh from '@/app/components/native/useNativeRefresh';
import Avatar from '@/app/components/Avatar';
import Icon from '@/app/components/Icon';

const profile = (u) => `/u/${encodeURIComponent(u.username)}`;

function Row({ u, children }) {
  const name = u.display_name || u.username;
  return (
    <li className="list-row person-row">
      <Avatar name={name} />
      <Link href={profile(u)} className="lr-main person-link"><span className="person-name">{name}</span><span className="lr-sub">@{u.username}</span></Link>
      <span className="person-actions">{children}</span>
    </li>
  );
}

export default function FriendsBoard() {
  const [friends, setFriends] = useState(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [msg, setMsg] = useState('');
  const searchRef = useRef(null);

  const load = () => api('/api/friends').then((r) => setFriends(r.friends)).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);
  useNativeRefresh(load);

  async function search(e) {
    e.preventDefault();
    try { setFound((await api(`/api/users/search?q=${encodeURIComponent(q)}`)).users); setMsg(''); } catch (err) { setMsg(err.message); }
  }
  async function act(action, userId) {
    try {
      setFriends((await api('/api/friends', 'POST', { action, userId })).friends);
      if (found) setFound((await api(`/api/users/search?q=${encodeURIComponent(q)}`)).users);
    } catch (err) { setMsg(err.message); }
  }

  const all = friends || [];
  const incoming = all.filter((f) => f.status === 'pending' && !f.outgoing);
  const outgoing = all.filter((f) => f.status === 'pending' && f.outgoing);
  const accepted = all.filter((f) => f.status === 'accepted');

  return (
    <div className="social">
      {msg && <div className="alert error" role="alert">{msg}</div>}
      <form className="card friend-search" onSubmit={search} role="search">
        <div className="field"><label htmlFor="fq">Szukaj osoby</label>
          <div className="search-row">
            <input id="fq" ref={searchRef} className="input" value={q} onChange={(e) => setQ(e.target.value)} minLength={2} placeholder="Nazwa lub nick" autoComplete="off" />
            <button className="btn"><Icon name="search" size={18} />Szukaj</button>
          </div></div>
      </form>

      {found && (
        <>
          <h2 className="section-label">Wyniki wyszukiwania</h2>
          {found.length === 0 ? <p className="muted social-note">Nikogo nie znaleziono. Sprawdź pisownię nicku.</p> : (
            <ul className="list">{found.map((u) => (
              <Row key={u.id} u={u}>
                {!u.status && <button className="btn small" onClick={() => act('request', u.id)}>Dodaj</button>}
                {u.status === 'pending' && u.outgoing && <span className="person-state">Zaproszenie wysłane</span>}
                {u.status === 'pending' && !u.outgoing && <button className="btn small" onClick={() => act('accept', u.id)}>Akceptuj</button>}
                {u.status === 'accepted' && <span className="person-state">Znajomy</span>}
              </Row>
            ))}</ul>)}
        </>
      )}

      {incoming.length > 0 && (
        <>
          <h2 className="section-label">Zaproszenia do Ciebie ({incoming.length})</h2>
          <ul className="list">{incoming.map((u) => (
            <Row key={u.id} u={u}>
              <button className="btn small" onClick={() => act('accept', u.id)}>Akceptuj</button>
              <button className="btn text small" onClick={() => act('remove', u.id)}>Odrzuć</button>
            </Row>))}</ul>
        </>
      )}

      <h2 className="section-label">Znajomi{friends && accepted.length > 0 ? ` (${accepted.length})` : ''}</h2>
      {friends === null ? <p className="muted social-note">Ładuję…</p> : accepted.length === 0 ? (
        <div className="empty card">
          <Icon name="users" size={32} />
          <h2>Nie masz jeszcze znajomych</h2>
          <p>Znajomi widzą oceny i opinie, które im udostępnisz. Wyszukaj kogoś po nicku.</p>
          <button type="button" className="btn ghost" onClick={() => searchRef.current?.focus()}>Szukaj osoby</button>
        </div>
      ) : (
        <ul className="list">{accepted.map((u) => (
          <Row key={u.id} u={u}><button className="btn text small" onClick={() => confirm('Usunąć ze znajomych?') && act('remove', u.id)}>Usuń</button></Row>))}</ul>)}

      {outgoing.length > 0 && (
        <>
          <h2 className="section-label">Wysłane zaproszenia</h2>
          <ul className="list">{outgoing.map((u) => (
            <Row key={u.id} u={u}><button className="btn text small" onClick={() => act('remove', u.id)}>Cofnij</button></Row>))}</ul>
        </>
      )}
    </div>
  );
}
