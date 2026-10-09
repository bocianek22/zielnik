'use client';
import { clearQueue } from '@/lib/offline-client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { fileToDataUrl } from '@/lib/image';
import { clearDeviceData } from '../components/deviceData';
import { storedFcm, widgetClear } from '../components/native/bridge';
import { VIS } from '@/lib/visibility';
import Icon from '../components/Icon';
import Toast from '../components/Toast';
import Sessions from './Sessions';
import EmailSettings from './EmailSettings';

export default function ProfileForm({ me, initial, children }) {
  const router = useRouter();
  const [f, setF] = useState({
    displayName: initial.display_name || '', bio: initial.bio || '', links: (initial.links || []).slice(0, 3),
    profileVisibility: initial.profile_visibility || 'friends',
  });
  const [avatar, setAvatar] = useState(undefined); // undefined = bez zmian, null = usuń, string = nowy
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState('');
  const [csvFrom, setCsvFrom] = useState('');
  const [csvTo, setCsvTo] = useState('');

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
  async function shareProfile() {
    const url = `${location.origin}/u/${encodeURIComponent(me.username)}`;
    if (navigator.share) { try { await navigator.share({ title: 'Mój profil w Zielniku', url }); } catch {} }
    else { try { await navigator.clipboard.writeText(url); setMsg('Skopiowano link do profilu.'); } catch { setMsg(url); } }
  }

  async function del() {
    if (!confirm('Trwale usunąć konto i wszystkie Twoje dane? Tego nie da się cofnąć.')) return;
    try { await api('/api/account', 'DELETE', { password: pw }); await clearQueue(); widgetClear(); router.replace('/login'); router.refresh(); }
    catch (err) { setMsg(err.message); }
  }

  async function logoutAll() {
    if (!confirm('Wylogować ze wszystkich urządzeń, także z tego?')) return;
    try { await api('/api/auth/logout', 'POST', { all: true, fcmToken: storedFcm() || undefined }); clearDeviceData(); widgetClear(); router.replace('/login'); router.refresh(); }
    catch (err) { setMsg(err.message); }
  }

  return (
    <div className="stack">
      <form className="stack" onSubmit={save}>
        <h2 className="section-label">Tożsamość</h2>
        <div className="card stack">
          <div className="photo-edit profile-id">
            {shown ? <img className="avatar" src={shown} alt="Awatar" /> : <div className="avatar ph">{me.username[0].toUpperCase()}</div>}
            <div className="profile-who"><b>{f.displayName || me.username}</b><span className="muted">@{me.username}</span></div>
            <div className="photo-actions">
              <label className="btn ghost small file-btn">Zmień awatar<input type="file" accept="image/*" hidden onChange={pick} /></label>
              {shown && <button type="button" className="btn ghost small" onClick={() => setAvatar(null)}>Usuń awatar</button>}
            </div>
          </div>
          <div className="field"><label htmlFor="p-name">Nazwa wyświetlana</label>
            <input id="p-name" className="input" maxLength={40} value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></div>
          <div className="field"><label htmlFor="p-bio">O mnie</label>
            <textarea id="p-bio" className="input" rows={4} maxLength={500} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
        </div>

        <h2 className="section-label">Widoczność</h2>
        <div className="card stack">
          <div className="field"><label htmlFor="p-vis">Kto widzi mój profil</label>
            <select id="p-vis" className="input vis-select" value={f.profileVisibility} onChange={(e) => setF({ ...f, profileVisibility: e.target.value })}>
              {VIS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select>
            <small>Dotyczy opisu, awatara, ocen i testów, zgodnie z ich ustawieniami.</small></div>
        </div>

        <h2 className="section-label">Linki</h2>
        <div className="card stack">
          {f.links.length === 0 && <p className="muted">Do 3 linków, np. do mediów społecznościowych.</p>}
          {f.links.map((l, i) => (
            <div key={i} className="link-row">
              <input className="input" type="url" placeholder="https://…" aria-label={`Link ${i + 1}`} value={l}
                onChange={(e) => setF({ ...f, links: f.links.map((x, j) => (j === i ? e.target.value : x)) })} />
              <button type="button" className="btn text small" onClick={() => setF({ ...f, links: f.links.filter((_, j) => j !== i) })} aria-label={`Usuń link ${i + 1}`}>Usuń</button>
            </div>))}
          {f.links.length < 3 && <div><button type="button" className="btn ghost small" onClick={() => setF({ ...f, links: [...f.links, ''] })}><Icon name="plus" size={18} />Dodaj link</button></div>}
        </div>

        <div className="row profile-save">
          <button className="btn" disabled={busy} aria-busy={busy || undefined}>Zapisz profil</button>
          <Link className="btn ghost" href={`/u/${encodeURIComponent(me.username)}`}>Zobacz mój profil</Link>
          <button type="button" className="btn ghost only-mobile" onClick={shareProfile}><Icon name="share" size={18} />Udostępnij</button>
          <Toast text={msg} tone={/^(Zapisano|Skopiowano)/.test(msg) ? 'ok' : 'warn'} onClose={() => setMsg('')} duration={/^(Zapisano|Skopiowano)/.test(msg) ? 4000 : 10000} />
        </div>
      </form>

      {children}

      <h2 className="section-label">Dane i konto</h2>
      <section className="card">
        <h2>Moje dane</h2>
        <p className="muted">Pobierz kopię wszystkich swoich danych: profil, oceny, opinie, zużycie, zakupy, testy, znajomych i grupy.</p>
        <p className="muted">Dokumenty: <Link href="/regulamin">regulamin bety</Link> i <Link href="/prywatnosc">polityka prywatności</Link>.</p>
        <div className="list inset">
          <a className="list-row" href="/api/account/export"><Icon name="download" /><span className="lr-main">Pobierz dane (JSON)</span></a>
          <a className="list-row" href="/api/account/export?photos=1"><Icon name="download" /><span className="lr-main">Pobierz ze zdjęciami</span></a>
          <a className="list-row" href="/api/export"><Icon name="download" /><span className="lr-main">Moje odmiany (CSV)</span></a>
          <Link className="list-row" href="/import#kopia"><Icon name="download" /><span className="lr-main">Przywróć z kopii (plik JSON)</span></Link>
          <a className="list-row" href={`/api/account/export/csv${csvFrom || csvTo ? `?${new URLSearchParams({ ...(csvFrom && { od: csvFrom }), ...(csvTo && { do: csvTo }) })}` : ''}`}>
            <Icon name="download" /><span className="lr-main">Dziennik (CSV: objawy, zużycie, zakupy)</span>
          </a>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="csv-od">Dziennik od</label><input id="csv-od" className="input" type="date" value={csvFrom} max={csvTo || undefined} onChange={(e) => setCsvFrom(e.target.value)} /></div>
          <div className="field"><label htmlFor="csv-do">do</label><input id="csv-do" className="input" type="date" value={csvTo} min={csvFrom || undefined} onChange={(e) => setCsvTo(e.target.value)} /></div>
        </div>
        <p className="muted">Pusty zakres dat oznacza cały dziennik. Plik otwiera się w Excelu (separator „;”, przecinek dziesiętny).</p>
      </section>

      <EmailSettings isAdmin={me.isAdmin} />

      <section className="card">
        <h2>Sesje</h2>
        <p className="muted">Jeśli logowałeś się na cudzym lub zgubionym urządzeniu, wyloguj je z listy poniżej. Zmiana hasła wylogowuje wszystkie pozostałe urządzenia.</p>
        <Sessions />
        <div className="row"><button type="button" className="btn ghost" onClick={logoutAll}>Wyloguj ze wszystkich urządzeń</button></div>
      </section>

      <section className="card danger-zone">
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
