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
    <section className="admin-sec">
      <h2 className="section-label">Plany użytkowników</h2>
      <p className="muted small admin-note">Ręczne nadawanie Premium (np. testerom lub w podziękowaniu). Dopóki nie włączysz zmiennej PREMIUM_ENFORCED, wszyscy mają dostęp do wszystkiego.</p>
      {msg && <div className="alert error" role="alert">{msg}</div>}
      {users && (
        <ul className="list">
          {users.map((u) => (
            <li key={u.id} className="list-row admin-row">
              <div className="lr-main">
                <span className="admin-name">{u.username}</span>
                <span className="lr-sub">{u.plan === 'premium' ? `Premium · ${u.plan_until ? `do ${u.plan_until}` : 'bez limitu'}` : 'Darmowy'}</span>
              </div>
              <div className="admin-actions">
                <button className="btn ghost small" onClick={() => set(u.id, 'premium', 30)}>Premium 30 dni</button>
                <button className="btn ghost small" onClick={() => set(u.id, 'premium', 365)}>365 dni</button>
                <button className="btn ghost small" onClick={() => set(u.id, 'premium', 0)}>Bez limitu</button>
                {u.plan === 'premium' && <button className="btn text small" onClick={() => set(u.id, 'free', 0)}>Cofnij</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
