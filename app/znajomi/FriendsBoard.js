'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const profile = (u) => `/u/${encodeURIComponent(u.username)}`;

export default function FriendsBoard() {
  const [friends, setFriends] = useState([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => api('/api/friends').then((r) => setFriends(r.friends)).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);

  async function search(e) {
    e.preventDefault();
    try { setFound((await api(`/api/users/search?q=${encodeURIComponent(q)}`)).users); } catch (err) { setMsg(err.message); }
  }
  async function act(action, userId) {
    try {
      setFriends((await api('/api/friends', 'POST', { action, userId })).friends);
      if (found) setFound((await api(`/api/users/search?q=${encodeURIComponent(q)}`)).users);
    } catch (err) { setMsg(err.message); }
  }

  const incoming = friends.filter((f) => f.status === 'pending' && !f.outgoing);
  const outgoing = friends.filter((f) => f.status === 'pending' && f.outgoing);
  const accepted = friends.filter((f) => f.status === 'accepted');
  const Row = ({ u, children }) => (
    <li className="person"><Link href={profile(u)}><b>{u.display_name || u.username}</b> <span className="muted">@{u.username}</span></Link><span className="row">{children}</span></li>
  );

  return (
    <div className="stack">
      {msg && <div className="alert error" role="alert">{msg}</div>}
      <form className="card row" onSubmit={search}>
        <div className="field grow"><label htmlFor="fq">Wyszukaj użytkownika (nazwa lub nick)</label>
          <input id="fq" className="input" value={q} onChange={(e) => setQ(e.target.value)} minLength={2} /></div>
        <button className="btn">Szukaj</button>
      </form>
      {found && (
        <section className="card"><h2>Wyniki</h2>
          {found.length === 0 ? <p className="muted">Nikogo nie znaleziono.</p> : (
            <ul className="people">{found.map((u) => (
              <Row key={u.id} u={u}>
                {!u.status && <button className="btn small" onClick={() => act('request', u.id)}>Dodaj do znajomych</button>}
                {u.status === 'pending' && u.outgoing && <span className="badge">Zaproszenie wysłane</span>}
                {u.status === 'pending' && !u.outgoing && <button className="btn small" onClick={() => act('accept', u.id)}>Akceptuj</button>}
                {u.status === 'accepted' && <span className="badge">Znajomy</span>}
              </Row>
            ))}</ul>)}
        </section>
      )}
      {incoming.length > 0 && (
        <section className="card"><h2>Zaproszenia do Ciebie</h2>
          <ul className="people">{incoming.map((u) => (
            <Row key={u.id} u={u}>
              <button className="btn small" onClick={() => act('accept', u.id)}>Akceptuj</button>
              <button className="btn ghost small" onClick={() => act('remove', u.id)}>Odrzuć</button>
            </Row>))}</ul></section>
      )}
      <section className="card"><h2>Twoi znajomi ({accepted.length})</h2>
        {accepted.length === 0 ? <p className="muted">Nie masz jeszcze znajomych. Wyszukaj kogoś powyżej.</p> : (
          <ul className="people">{accepted.map((u) => (
            <Row key={u.id} u={u}><button className="btn ghost small" onClick={() => confirm('Usunąć ze znajomych?') && act('remove', u.id)}>Usuń</button></Row>))}</ul>)}
      </section>
      {outgoing.length > 0 && (
        <section className="card"><h2>Wysłane zaproszenia</h2>
          <ul className="people">{outgoing.map((u) => (
            <Row key={u.id} u={u}><button className="btn ghost small" onClick={() => act('remove', u.id)}>Cofnij</button></Row>))}</ul></section>
      )}
    </div>
  );
}
