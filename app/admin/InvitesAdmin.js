'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Icon from '../components/Icon';

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
  async function share(code) {
    const link = `${location.origin}/register?code=${code}`;
    if (navigator.share) { try { await navigator.share({ title: 'Zaproszenie do Zielnika', text: 'Dołącz do Zielnika:', url: link }); } catch {} }
    else copy(code);
  }

  return (
    <section className="admin-sec">
      <h2 className="section-label">Zaproszenia</h2>
      <form className="card admin-form" onSubmit={create}>
        <div className="field"><label htmlFor="inv-note">Dla kogo (notatka)</label>
          <input id="inv-note" className="input" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <div className="admin-pair">
          <div className="field"><label htmlFor="inv-max">Liczba użyć</label>
            <input id="inv-max" className="input" type="number" min="1" max="100" inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} /></div>
          <div className="field"><label htmlFor="inv-days">Ważny dni (0 = bez limitu)</label>
            <input id="inv-days" className="input" type="number" min="0" max="90" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></div>
        </div>
        <button className="btn">Utwórz kod</button>
      </form>
      {msg && <div className="alert note" role="status">{msg}</div>}
      {invites.length === 0 ? <p className="muted">Brak zaproszeń.</p> : (
        <ul className="list">
          {invites.map((i) => (
            <li key={i.code} className="list-row admin-row">
              <div className="lr-main">
                <code>{i.code}</code>
                <span className="lr-sub">{i.note ? `${i.note} · ` : ''}użyto {i.uses}/{i.max_uses} · {i.expires_at ? `ważny do ${i.expires_at}` : 'bez limitu'}</span>
              </div>
              <div className="admin-actions">
                <button className="btn ghost small" onClick={() => copy(i.code)}>Kopiuj link</button>
                <button className="btn ghost small only-mobile" onClick={() => share(i.code)}><Icon name="share" size={18} />Udostępnij</button>
                <button className="btn text small admin-del" onClick={() => remove(i.code)}>Usuń</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
