'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Icon from '../components/Icon';

export default function UsersAdmin({ meId }) {
  const [users, setUsers] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // { name, pass }
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setUsers((await api('/api/admin/users')).users);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    setError(''); setNotice(null); setBusy(true);
    try {
      const r = await api('/api/admin/users', 'POST', { username, password });
      setNotice({ name: r.user.username, pass: r.tempPassword });
      setUsername(''); setPassword('');
      await load();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function reset(u) {
    if (!confirm(`Zresetować hasło użytkownika ${u.username}?`)) return;
    setError(''); setNotice(null);
    try {
      const r = await api(`/api/admin/users/${u.id}`, 'PATCH');
      setNotice({ name: u.username, pass: r.tempPassword });
      await load();
    } catch (err) { setError(err.message); }
  }

  async function remove(u) {
    if (!confirm(`Usunąć użytkownika ${u.username} razem z jego ocenami i stanami?`)) return;
    setError(''); setNotice(null);
    try {
      await api(`/api/admin/users/${u.id}`, 'DELETE');
      await load();
    } catch (err) { setError(err.message); }
  }

  const status = (u) => [u.is_admin ? 'Administrator' : 'Użytkownik', u.must_change_password ? 'czeka na zmianę hasła' : 'aktywne'].join(' · ');

  return (
    <>
      <section className="admin-sec">
        <h2 className="section-label">Nowy użytkownik</h2>
        <form className="card admin-form" onSubmit={add}>
          <div className="admin-pair">
            <div className="field">
              <label htmlFor="nu">Nazwa użytkownika</label>
              <input id="nu" className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="np">Hasło tymczasowe (puste = losowe)</label>
              <input id="np" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <button className="btn" disabled={busy}>Dodaj użytkownika</button>
        </form>
      </section>

      {notice && (
        <div className="alert ok" role="status">
          Hasło tymczasowe dla <strong>{notice.name}</strong>: <code>{notice.pass}</code>. Pokazuję je tylko raz. Przy pierwszym logowaniu zostanie wymuszona zmiana.
        </div>
      )}
      {error && <div className="alert error" role="alert">{error}</div>}

      <section className="admin-sec">
        <h2 className="section-label">Konta{users ? ` (${users.length})` : ''}</h2>
        {!users ? <p className="muted">Wczytywanie…</p> : (
          <ul className="list admin-users">
            {users.map((u) => (u.id === meId ? (
              <li key={u.id} className="list-row">
                <div className="lr-main"><span className="admin-name">{u.username}</span><span className="lr-sub">To Ty · {status(u)}</span></div>
              </li>
            ) : (
              <li key={u.id}>
                <details className="admin-user">
                  <summary className="list-row">
                    <div className="lr-main"><span className="admin-name">{u.username}</span><span className="lr-sub">{status(u)}</span></div>
                    <Icon name="chevronDown" size={20} className="lr-chev" />
                  </summary>
                  <div className="admin-user-body">
                    <div className="admin-user-act">
                      <p className="muted small">Ustawia nowe hasło tymczasowe i wymusza jego zmianę przy logowaniu.</p>
                      <button className="btn ghost small" onClick={() => reset(u)}>Resetuj hasło</button>
                    </div>
                    <div className="admin-user-act admin-user-danger">
                      <p className="small">Usuwa konto razem z ocenami i stanami. Nie można tego cofnąć.</p>
                      <button className="btn danger small" onClick={() => remove(u)}>Usuń konto</button>
                    </div>
                  </div>
                </details>
              </li>
            )))}
          </ul>
        )}
      </section>
    </>
  );
}
