'use client';
import { useState, useSyncExternalStore } from 'react';
import Icon from '../components/Icon';
import { isNative } from '../components/native/bridge';
import { daysSince, lastBackup, markBackup } from '@/lib/last-backup';
import { formatDay } from '@/lib/date';

const subscribe = (cb) => { window.addEventListener('zielnik:backup', cb); return () => window.removeEventListener('zielnik:backup', cb); };
const native = () => isNative();
const dni = (n) => (n === 0 ? 'dziś' : n === 1 ? 'wczoraj' : `${n} dni temu`);

// POM-61: kopia pobrana w tej przeglądarce (zapis po udanym pobraniu). W APK pobieranie plików nie działa, więc tam bez.
export const backupTaken = markBackup;

// „Ostatnia kopia w tej przeglądarce: …” (dane tylko z tego urządzenia; w APK nic)
export default function LastBackup() {
  const day = useSyncExternalStore(subscribe, lastBackup, () => null);
  const app = useSyncExternalStore(() => () => {}, native, () => false);
  if (app) return null;
  const n = daysSince(day);
  return (
    <p className="muted last-backup" role="status">
      {day ? <>Ostatnia kopia pobrana w tej przeglądarce: <b>{formatDay(day)}</b> ({dni(n)}).{n > 30 && ' Warto pobrać nową.'}</>
        : 'W tej przeglądarce nie pobrano jeszcze kopii danych.'}
    </p>
  );
}

// „Pobierz dane (JSON)”: w przeglądarce pobranie przez fetch, żeby zapisać datę kopii tylko po sukcesie; bez JS i w APK
// zwykły odnośnik jak dotąd
export function JsonBackupLink() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function click(e) {
    if (isNative() || busy) return;
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/account/export', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Nie udało się pobrać danych. Spróbuj ponownie.');
      const name = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') || '')?.[1] || 'dane.json';
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      markBackup();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }
  return (
    <>
      <a className="list-row" href="/api/account/export" onClick={click} aria-busy={busy || undefined}><Icon name="download" /><span className="lr-main">Pobierz dane (JSON)</span></a>
      {err && <p className="alert error" role="alert">{err}</p>}
    </>
  );
}
