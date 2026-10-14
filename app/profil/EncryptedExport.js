'use client';
import { useEffect, useRef, useState } from 'react';
import { encryptBackup, PASSWORD_MIN } from '@/lib/backup-crypto';
import { isNative } from '../components/native/bridge';

// POM-57: kopia zaszyfrowana hasłem na tym urządzeniu. Eksport (bez zdjęć) pobieramy jak zwykle, szyfrujemy w przeglądarce
// i zapisujemy plik; hasło nie opuszcza urządzenia. Zgubione hasło = kopii nie da się otworzyć (mówimy to wprost).
export default function EncryptedExport() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [native, setNative] = useState(false);
  const openBtn = useRef(null);
  const refocus = useRef(false);
  // po „Anuluj” fokus wraca na przycisk otwierający (inaczej czytnik zaczyna od początku strony)
  useEffect(() => { if (!open && refocus.current) { refocus.current = false; openBtn.current?.focus(); } }, [open]);
  // w APK WebView nie zapisuje pliku z adresu blob:, więc tę opcję pokazujemy tylko w przeglądarce
  useEffect(() => { if (isNative()) setNative(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  async function save(e) {
    e.preventDefault();
    setErr(''); setOk('');
    if (pw.length < PASSWORD_MIN) return setErr(`Hasło musi mieć co najmniej ${PASSWORD_MIN} znaków.`);
    if (pw !== pw2) return setErr('Hasła się różnią.');
    setBusy(true);
    try {
      const res = await fetch('/api/account/export', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Nie udało się pobrać danych. Spróbuj ponownie.');
      const file = await encryptBackup(await res.text(), pw);
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());
      const url = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `kopia-zaszyfrowana-${day}.json` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setPw(''); setPw2(''); setOk('Zapisano zaszyfrowaną kopię. Przechowuj hasło osobno.');
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  }

  if (native) return <p className="muted small">Kopię zabezpieczoną hasłem zapiszesz w przeglądarce na telefonie lub komputerze (profil, „Moje dane”).</p>;
  if (!open) return <div><button ref={openBtn} type="button" className="btn ghost" onClick={() => setOpen(true)}>Pobierz kopię zabezpieczoną hasłem</button></div>;
  return (
    <form className="card stack enc-export" onSubmit={save} aria-labelledby="enc-h">
      <h3 id="enc-h">Kopia zabezpieczona hasłem</h3>
      <p className="muted small">Plik szyfrujemy na tym urządzeniu; hasło nie trafia na serwer. Bez hasła nikt, także my, nie otworzy kopii, a zapomnianego hasła nie da się odzyskać. Zdjęcia nie są dołączane.</p>
      <div className="field"><label htmlFor="enc-pw">Hasło do pliku (co najmniej {PASSWORD_MIN} znaków)</label>
        <input id="enc-pw" className="input" type="password" autoComplete="new-password" autoFocus aria-invalid={!!err || undefined} aria-describedby={err ? 'enc-err' : undefined} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      <div className="field"><label htmlFor="enc-pw2">Powtórz hasło</label>
        <input id="enc-pw2" className="input" type="password" autoComplete="new-password" aria-invalid={!!err || undefined} aria-describedby={err ? 'enc-err' : undefined} value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
      {err && <p id="enc-err" className="alert error" role="alert">{err}</p>}
      {ok && <p className="alert ok" role="status">{ok}</p>}
      <div className="row"><button className="btn" disabled={busy}>{busy ? 'Szyfruję…' : 'Zapisz zaszyfrowaną kopię'}</button>
        <button type="button" className="btn ghost" onClick={() => { refocus.current = true; setOpen(false); setPw(''); setPw2(''); setErr(''); }}>Anuluj</button></div>
    </form>
  );
}
