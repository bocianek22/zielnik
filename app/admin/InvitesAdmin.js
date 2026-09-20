'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function InvitesAdmin() {
  const [invites, setInvites] = useState([]);
  const [note, setNote] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [days, setDays] = useState(14);
  const [msg, setMsg] = useState('');

  const load = () => api('/api/admin/invites').then((r) => setInvites(r.invites)).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    try { setInvites((await api('/api/admin/invites', 'POST', { note, maxUses, days })).invites); setNote(''); }
    catch (err) { setMsg(err.message); }
  }
  async function remove(code) {
    setInvites((await api('/api/admin/invites', 'DELETE', { code })).invites);
  }
  async function copy(code) {
    const link = `${location.origin}/register?code=${code}`;
    try { await navigator.clipboard.writeText(link); setMsg('Skopiowano link zaproszenia.'); } catch { setMsg(link); }
  }

  return (
    <section className="card">
      <h2>Zaproszenia</h2>
      <form className="row" onSubmit={create}>
        <div className="field grow"><label htmlFor="inv-note">Dla kogo (notatka)</label>
          <input id="inv-note" className="input" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <div className="field"><label htmlFor="inv-max">Liczba użyć</label>
          <input id="inv-max" className="input" type="number" min="1" max="100" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} /></div>
        <div className="field"><label htmlFor="inv-days">Ważny dni (0 = bez limitu)</label>
          <input id="inv-days" className="input" type="number" min="0" max="90" value={days} onChange={(e) => setDays(e.target.value)} /></div>
        <button className="btn">Utwórz kod</button>
      </form>
      {msg && <div className="alert note" role="status">{msg}</div>}
      {invites.length === 0 ? <p className="muted">Brak zaproszeń.</p> : (
        <div className="table-wrap"><table className="cmp"><thead><tr><th>Kod</th><th>Notatka</th><th>Użyto</th><th>Ważny do</th><th /></tr></thead>
          <tbody>{invites.map((i) => (
            <tr key={i.code}><td><code>{i.code}</code></td><td>{i.note || '–'}</td><td>{i.uses}/{i.max_uses}</td><td>{i.expires_at || 'bez limitu'}</td>
              <td className="row"><button className="btn ghost small" onClick={() => copy(i.code)}>Kopiuj link</button>
                <button className="btn ghost small" onClick={() => remove(i.code)}>Usuń</button></td></tr>
          ))}</tbody></table></div>
      )}
    </section>
  );
}
