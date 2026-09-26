'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function PlansAdmin() {
  const [users, setUsers] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/api/admin/plan').then((r) => setUsers(r.users)).catch((e) => setMsg(e.message)); }, []);
  async function set(userId, plan, days) {
    try { setUsers((await api('/api/admin/plan', 'POST', { userId, plan, days })).users); } catch (e) { setMsg(e.message); }
  }
  return (
    <section className="card">
      <h2>Plany użytkowników</h2>
      <p className="muted">Ręczne nadawanie Premium (np. testerom lub w podziękowaniu). Dopóki nie włączysz zmiennej PREMIUM_ENFORCED, wszyscy mają dostęp do wszystkiego.</p>
      {msg && <div className="alert error" role="alert">{msg}</div>}
      {users && (
        <div className="table-wrap"><table className="cmp"><thead><tr><th>Użytkownik</th><th>Plan</th><th>Ważny do</th><th /></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}><td>{u.username}</td><td>{u.plan}</td><td>{u.plan_until || (u.plan === 'premium' ? 'bez limitu' : '–')}</td>
              <td className="row">
                <button className="btn ghost small" onClick={() => set(u.id, 'premium', 30)}>Premium 30 dni</button>
                <button className="btn ghost small" onClick={() => set(u.id, 'premium', 365)}>365 dni</button>
                <button className="btn ghost small" onClick={() => set(u.id, 'premium', 0)}>Bez limitu</button>
                {u.plan === 'premium' && <button className="btn ghost small" onClick={() => set(u.id, 'free', 0)}>Cofnij</button>}
              </td></tr>))}</tbody></table></div>
      )}
    </section>
  );
}
