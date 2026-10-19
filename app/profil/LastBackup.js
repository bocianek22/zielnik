'use client';
import { useState, useSyncExternalStore } from 'react';
import Icon from '../components/Icon';
import { canNativeShareJson, isNative, nativeShareJson } from '../components/native/bridge';
import { syncLocal } from '../components/localReminders';
import { daysSince, lastBackup, markBackup } from '@/lib/last-backup';
import { formatDay } from '@/lib/date';

const subscribe = (cb) => { window.addEventListener('zielnik:backup', cb); return () => window.removeEventListener('zielnik:backup', cb); };
// APK bez wtyczki shareJson (starsze niż 0.8.0): kopii nie da się zapisać, więc nie pokazujemy daty
const nativeOld = () => isNative() && !canNativeShareJson();
const dni = (n) => (n === 0 ? 'dziś' : n === 1 ? 'wczoraj' : `${n} dni temu`);

// POM-61: kopia zapisana na tym urządzeniu (po udanym pobraniu w przeglądarce albo po otwarciu okna „Udostępnij” w APK).
// W APK układa od nowa lokalne przypomnienie o kopii (30 dni od dziś); w przeglądarce syncLocal nic nie robi.
export function backupTaken() {
  markBackup();
  syncLocal().catch(() => {});
}

// Zapis pliku kopii: w APK okno „Udostępnij” (Dysk, Pliki, poczta), w przeglądarce zwykłe pobranie
export async function saveBackupFile(text, name) {
  if (isNative()) return nativeShareJson(text, name);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// „Ostatnia kopia na tym urządzeniu: …” (dane tylko z tego urządzenia)
export default function LastBackup() {
  const day = useSyncExternalStore(subscribe, lastBackup, () => null);
  const old = useSyncExternalStore(() => () => {}, nativeOld, () => false);
  const app = useSyncExternalStore(() => () => {}, isNative, () => false);
  if (old) return <p className="muted">Kopię danych zapiszesz w nowszej wersji aplikacji albo w przeglądarce (profil, „Moje dane”).</p>;
  const n = daysSince(day);
  const where = app ? 'na tym telefonie' : 'w tej przeglądarce';
  return (
    <p className="muted last-backup" role="status">
      {day ? <>Ostatnia kopia zapisana {where}: <b>{formatDay(day)}</b> ({dni(n)}).{n > 30 && ' Warto zapisać nową.'}</>
        : `${where[0].toUpperCase()}${where.slice(1)} nie zapisano jeszcze kopii danych.`}
    </p>
  );
}

// „Pobierz dane (JSON)”: pobranie przez fetch, żeby zapisać datę kopii tylko po sukcesie; w APK plik idzie do okna
// „Udostępnij” (WebView nie pobiera plików); bez JS i w starszym APK zwykły odnośnik jak dotąd
export function JsonBackupLink() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function click(e) {
    if ((isNative() && !canNativeShareJson()) || busy) return;
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/account/export', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Nie udało się pobrać danych. Spróbuj ponownie.');
      const name = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') || '')?.[1] || 'dane.json';
      await saveBackupFile(await res.text(), name);
      backupTaken();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }
  return (
    <>
      <a className="list-row" href="/api/account/export" onClick={click} aria-busy={busy || undefined}><Icon name="download" /><span className="lr-main">Pobierz dane (JSON)</span></a>
      {err && <p className="alert error" role="alert">{err}</p>}
    </>
  );
}
