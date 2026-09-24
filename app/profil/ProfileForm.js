'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { fileToDataUrl } from '@/lib/image';
import { VIS } from '@/lib/visibility';

export default function ProfileForm({ me, initial }) {
  const router = useRouter();
  const [f, setF] = useState({
    displayName: initial.display_name || '', bio: initial.bio || '', links: [...(initial.links || []), '', '', ''].slice(0, 3),
    profileVisibility: initial.profile_visibility || 'friends',
  });
  const [avatar, setAvatar] = useState(undefined); // undefined = bez zmian, null = usuń, string = nowy
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState('');

  const shown = avatar === undefined ? (initial.has_avatar ? `/api/users/${me.id}/avatar?t=${Date.now() % 1e6}` : null) : avatar;

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) try { setAvatar(await fileToDataUrl(file, 256, 0.8)); } catch (err) { setMsg(err.message); }
  }
  async function save(e) {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      await api('/api/profile', 'PUT', { ...f, ...(avatar !== undefined ? { avatar } : {}) });
      setMsg('Zapisano.'); router.refresh();
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  }
  async function del() {
    if (!confirm('Trwale usunąć konto i wszystkie Twoje dane? Tego nie da się cofnąć.')) return;
    try { await api('/api/account', 'DELETE', { password: pw }); router.replace('/login'); router.refresh(); }
    catch (err) { setMsg(err.message); }
  }

  return (
    <div className="stack">
      <form className="card stack" onSubmit={save}>
        <div className="photo-edit">
          {shown ? <img className="avatar" src={shown} alt="Awatar" /> : <div className="avatar ph">{me.username[0].toUpperCase()}</div>}
          <div className="photo-actions">
            <label className="btn ghost small file-btn">Zmień awatar<input type="file" accept="image/*" hidden onChange={pick} /></label>
            {shown && <button type="button" className="btn ghost small" onClick={() => setAvatar(null)}>Usuń awatar</button>}
          </div>
        </div>
        <div className="field"><label htmlFor="p-name">Nazwa wyświetlana</label>
          <input id="p-name" className="input" maxLength={40} value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></div>
        <div className="field"><label htmlFor="p-bio">O mnie</label>
          <textarea id="p-bio" className="input" rows={4} maxLength={500} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
        <div className="field"><span className="label">Linki (do 3, np. media społecznościowe)</span>
          {f.links.map((l, i) => (
            <input key={i} className="input" type="url" placeholder="https://…" aria-label={`Link ${i + 1}`} value={l}
              onChange={(e) => setF({ ...f, links: f.links.map((x, j) => (j === i ? e.target.value : x)) })} />))}</div>
        <div className="field"><label htmlFor="p-vis">Kto widzi mój profil (opis, awatar, oceny i testy zgodnie z ich ustawieniami)</label>
          <select id="p-vis" className="input vis-select" value={f.profileVisibility} onChange={(e) => setF({ ...f, profileVisibility: e.target.value })}>
            {VIS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></div>
        <div className="row">
          <button className="btn" disabled={busy}>Zapisz profil</button>
          <Link className="btn ghost" href={`/u/${encodeURIComponent(me.username)}`}>Zobacz mój profil</Link>
          <span role="status" className="muted">{msg}</span>
        </div>
      </form>

      <section className="card">
        <h2>Moje dane</h2>
        <p className="muted">Pobierz kopię wszystkich swoich danych: profil, oceny, opinie, zużycie, zakupy, testy, znajomych i grupy.</p>
        <div className="row">
          <a className="btn ghost" href="/api/account/export">Pobierz dane (JSON)</a>
          <a className="btn ghost" href="/api/account/export?photos=1">Pobierz ze zdjęciami</a>
          <a className="btn ghost" href="/api/export">Moje odmiany (CSV)</a>
        </div>
      </section>

      <section className="card">
        <h2>Usuń konto</h2>
        {me.isAdmin ? <p className="muted">Konta admina nie można usunąć samodzielnie.</p> : (
          <>
            <p className="muted">Usuwa konto oraz wszystkie Twoje wpisy, zakupy, zużycie i testy. Wpisz hasło, aby potwierdzić.</p>
            <div className="row"><input className="input" type="password" aria-label="Hasło" value={pw} onChange={(e) => setPw(e.target.value)} />
              <button className="btn danger" onClick={del} disabled={!pw}>Usuń konto</button></div>
          </>
        )}
      </section>
    </div>
  );
}
