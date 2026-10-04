'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import LogoutButton from '../components/LogoutButton';

const when = (iso) => new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
const COUNTRY = (() => { try { return new Intl.DisplayNames(['pl'], { type: 'region' }); } catch { return null; } })();
const country = (c) => { try { return (c && COUNTRY?.of(c)) || c; } catch { return c; } };

// Zalogowane urządzenia (POM-27): lista aktywnych sesji, wylogowanie jednej i wszystkich pozostałych
export default function Sessions() {
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => api('/api/account/sessions').then((r) => setList(r.sessions), (err) => setMsg(err.message)), []);
  useEffect(() => { load(); }, [load]);

  async function drop(id) {
    setMsg('');
    try { await api(`/api/account/sessions/${encodeURIComponent(id)}`, 'DELETE'); await load(); setMsg('Wylogowano urządzenie.'); }
    catch (err) { setMsg(err.message); }
  }
  async function dropOthers() {
    if (!confirm('Wylogować wszystkie inne urządzenia? To urządzenie zostanie zalogowane.')) return;
    setMsg('');
    try { await api('/api/account/sessions', 'DELETE'); await load(); setMsg('Wylogowano inne urządzenia.'); }
    catch (err) { setMsg(err.message); }
  }

  const others = list?.filter((s) => !s.current).length ?? 0;
  return (
    <>
      <h3>Zalogowane urządzenia</h3>
      {!list ? <p className="muted">{msg || 'Wczytywanie…'}</p> : (
        <ul className="list inset">
          {list.map((s) => (
            <li key={s.id} className="list-row">
              <span className="lr-main">
                {s.device || 'Nieznane urządzenie'}{s.current && <> <span className="badge">to urządzenie</span></>}
                <span className="lr-sub">
                  {[s.country && country(s.country), `ostatnio ${when(s.last_used_at)}`, `zalogowano ${when(s.created_at)}`].filter(Boolean).join(' · ')}
                </span>
              </span>
              {s.current
                ? <LogoutButton className="btn ghost small">Wyloguj</LogoutButton>
                : <button type="button" className="btn ghost small" onClick={() => drop(s.id)}>Wyloguj</button>}
            </li>
          ))}
        </ul>
      )}
      <div className="row">
        {others > 0 && <button type="button" className="btn ghost" onClick={dropOthers}>Wyloguj inne urządzenia</button>}
        {list && <span role="status" className="muted">{msg}</span>}
      </div>
    </>
  );
}
