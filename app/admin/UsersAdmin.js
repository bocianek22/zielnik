'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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

  return (
    <>
      <form className="card" onSubmit={add}>
        <h2>Nowy użytkownik</h2>
        <div className="row">
          <div className="field grow">
            <label htmlFor="nu">Nazwa użytkownika</label>
            <input id="nu" className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="field grow">
            <label htmlFor="np">Hasło tymczasowe (puste = losowe)</label>
            <input id="np" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <button className="btn" disabled={busy}>Dodaj użytkownika</button>
      </form>

      {notice && (
        <div className="alert ok" role="status">
          Hasło tymczasowe dla <strong>{notice.name}</strong>: <code>{notice.pass}</code>. Pokazuję je tylko raz. Przy pierwszym logowaniu zostanie wymuszona zmiana.
        </div>
      )}
      {error && <div className="alert error" role="alert">{error}</div>}

      <div className="card">
        <h2>Konta</h2>
        {!users ? <p className="muted">Wczytywanie…</p> : (
          <div className="scroll">
            <table className="table">
              <thead><tr><th>Użytkownik</th><th>Rola</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.is_admin ? <span className="badge gold">admin</span> : <span className="badge">użytkownik</span>}</td>
                    <td>{u.must_change_password ? 'czeka na zmianę hasła' : 'aktywne'}</td>
                    <td className="actions">
                      {u.id !== meId && (
                        <>
                          <button className="btn ghost small" onClick={() => reset(u)}>Resetuj hasło</button>
                          <button className="btn danger small" onClick={() => remove(u)}>Usuń</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
