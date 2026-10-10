'use client';
import SecHead from '../components/SecHead';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { fcmToken, hasFcm, isNative, pushPermission, removeFcm, requestPushPermission, saveFcm, storedFcm } from '../components/native/bridge';

// Klucz VAPID (base64url) w postaci wymaganej przez pushManager.subscribe
function keyBytes(b64) {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
const sameKey = (buf, b64) => {
  if (!buf) return false;
  const a = new Uint8Array(buf), b = keyBytes(b64);
  return a.length === b.length && a.every((x, i) => x === b[i]);
};

async function registration() {
  await navigator.serviceWorker.register('/sw.js');
  // ready nie kończy się, gdy service worker się nie zainstalował; nie blokujemy wtedy ustawień w nieskończoność
  return Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('Service worker nie odpowiada. Odśwież stronę.')), 10000))]);
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

export default function PushSettings() {
  const [env, setEnv] = useState(null); // null = sprawdzanie
  const [cfg, setCfg] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [sub, setSub] = useState(null); // subskrypcja tego urządzenia
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const native = isNative();
    setEnv({ supported, ios, standalone, native, fcm: hasFcm() });
    (async () => {
      try {
        const c = await api('/api/push/config');
        setCfg(c); setPrefs(c.prefs);
        // aplikacja natywna: token FCM zamiast Web Push (mobile/README.md)
        if (native) {
          if (hasFcm() && storedFcm() && (await pushPermission()) === 'granted') setSub({ native: true });
          return;
        }
        if (!c.enabled || !supported) return;
        const reg = await navigator.serviceWorker.getRegistration();
        const s = reg && await reg.pushManager.getSubscription();
        if (s && Notification.permission === 'granted' && sameKey(s.options.applicationServerKey, c.publicKey)) {
          // ponowny zapis (urządzenie mogło zniknąć z bazy); należące do innego konta pokazujemy jako wyłączone
          const r = await api('/api/push/subscription', 'POST', { subscription: s.toJSON() });
          if (r.owned) setSub(s);
        }
      } catch (e) { setMsg(e.message); }
    })();
  }, []);

  async function enableNative() {
    setBusy(true); setMsg('');
    try {
      if ((await requestPushPermission()) !== 'granted') throw new Error('Powiadomienia są zablokowane. Zezwól na nie dla tej aplikacji w ustawieniach telefonu i spróbuj ponownie.');
      await saveFcm(await fcmToken(), true);
      setSub({ native: true });
      setPrefs((p) => ({ ...p, devices: Math.max(1, p.devices || 0) }));
      setMsg('Telefon zapisany do powiadomień.');
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  async function enable() {
    if (env.native) return enableNative();
    setBusy(true); setMsg('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error(perm === 'denied'
        ? 'Powiadomienia są zablokowane w ustawieniach przeglądarki lub telefonu. Zezwól na nie dla tej aplikacji i spróbuj ponownie.'
        : 'Nie udzielono zgody na powiadomienia.');
      const reg = await registration();
      let s = await reg.pushManager.getSubscription();
      if (s && !sameKey(s.options.applicationServerKey, cfg.publicKey)) { await s.unsubscribe(); s = null; }
      s ||= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.publicKey) });
      await api('/api/push/subscription', 'POST', { subscription: s.toJSON(), claim: true });
      setSub(s);
      setPrefs((p) => ({ ...p, devices: Math.max(1, p.devices || 0) }));
      setMsg('Powiadomienia włączone na tym urządzeniu.');
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  async function disable() {
    setBusy(true); setMsg('');
    try {
      if (sub.native) await removeFcm();
      else {
        const endpoint = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
        await api('/api/push/subscription', 'DELETE', { endpoint });
      }
      setSub(null);
      setPrefs((p) => ({ ...p, devices: Math.max(0, (p.devices || 0) - 1) }));
      setMsg('Powiadomienia wyłączone na tym urządzeniu.');
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  async function save(patch) {
    const prev = prefs;
    setPrefs({ ...prefs, ...patch }); setMsg('');
    try { const r = await api('/api/push/prefs', 'PUT', patch); setPrefs(r.prefs); setMsg('Zapisano.'); }
    catch (e) { setPrefs(prev); setMsg(e.message); }
  }

  async function test() {
    setBusy(true); setMsg('');
    try { await api('/api/push/test', 'POST'); setMsg('Wysłano. Powiadomienie powinno pojawić się za chwilę.'); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  }

  let body;
  if (!env || !cfg) body = <p className="muted">Sprawdzanie…</p>;
  else if (env.native) {
    if (!env.fcm) body = <p className="muted">Powiadomienia w aplikacji wymagają konfiguracji Firebase. Pojawią się w jednej z kolejnych wersji aplikacji.</p>;
  } else if (!cfg.enabled) body = <p className="muted">Powiadomienia nie są jeszcze włączone na serwerze. Gdy administrator je skonfiguruje, ustawisz je tutaj.</p>;
  else if (env.ios && !env.standalone) body = (
    <p className="alert note">Na iPhonie i iPadzie powiadomienia działają tylko w aplikacji dodanej do ekranu głównego (iOS 16.4 lub nowszy):
      w Safari stuknij „Udostępnij”, potem „Do ekranu początkowego”, otwórz aplikację z ikony i wróć tutaj.</p>);
  else if (!env.supported) body = <p className="muted">Ta przeglądarka nie obsługuje powiadomień push.</p>;
  body ??= (
    <>
      {env.native && !cfg.fcm && <p className="muted small">Serwer nie ma jeszcze włączonej wysyłki do aplikacji (Firebase): telefon zostanie zapisany, a przypomnienia zaczną docierać po jej skonfigurowaniu.</p>}
      <div className="row">
        {sub
          ? <button type="button" className="btn ghost" onClick={disable} disabled={busy}>Wyłącz na tym urządzeniu</button>
          : <button type="button" className="btn" onClick={enable} disabled={busy}>Włącz powiadomienia</button>}
        {sub && (!sub.native || cfg.fcm) && <button type="button" className="btn ghost" onClick={test} disabled={busy}>Wyślij testowe powiadomienie</button>}
      </div>
      {prefs && (
        <fieldset className="push-prefs" aria-label="Rodzaje przypomnień" disabled={!sub && !prefs.devices}>
          <label className="switch-row"><span>Recepta traci ważność za 7 dni lub mniej, a zostało coś do wykupienia</span>
            <input type="checkbox" className="switch" role="switch" checked={prefs.notifyPrescription} onChange={(e) => save({ notifyPrescription: e.target.checked })} /></label>
          <label className="switch-row"><span>Kończy się zapas (wg średniego zużycia z 30 dni)</span>
            <input type="checkbox" className="switch" role="switch" checked={prefs.notifyStock} onChange={(e) => save({ notifyStock: e.target.checked })} /></label>
          <div className="push-row">
            <label htmlFor="push-days">Przypomnij, gdy zapasu zostanie na</label>
            <select id="push-days" className="input" value={prefs.stockDays} disabled={!prefs.notifyStock} onChange={(e) => save({ stockDays: Number(e.target.value) })}>
              {[2, 3, 5, 7, 10, 14].concat(prefs.stockDays).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
                .map((d) => <option key={d} value={d}>{d} dni lub mniej</option>)}
            </select>
          </div>
          <div className="push-row">
            <label htmlFor="push-hour">Godzina (czas polski)</label>
            <select id="push-hour" className="input" value={prefs.notifyHour} disabled={!cfg.hourly} onChange={(e) => save({ notifyHour: Number(e.target.value) })}>
              {HOURS.concat(prefs.notifyHour).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b)
                .map((h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
          {!cfg.hourly && <p className="muted small">Na razie serwer wysyła przypomnienia raz dziennie, ok. 9:00 (zimą ok. 8:00).</p>}
          <label className="switch-row"><span>Pokazuj szczegóły w powiadomieniu</span>
            <input type="checkbox" className="switch" role="switch" checked={prefs.showDetails} onChange={(e) => save({ showDetails: e.target.checked })} /></label>
          <p className="muted small">W aplikacji na Androida powiadomienia zawsze są bez szczegółów (treść przechodzi przez serwery Google).</p>
          <p className="muted small">Bez tej opcji powiadomienie brzmi tylko „Masz 2 przypomnienia”, bo jego treść może być widoczna na zablokowanym ekranie.
            Nazwy odmian nie trafiają do powiadomień nigdy.</p>
        </fieldset>
      )}
      {!sub && prefs?.devices > 0 && <p className="muted small">Powiadomienia są włączone na innym urządzeniu ({prefs.devices}).</p>}
    </>
  );

  return (
    <section className="card stack" aria-labelledby="push-h">
      <SecHead icon="bell" id="push-h">Powiadomienia</SecHead>
      <p className="muted">Przypomnienia o kończącej się recepcie i zapasie, zebrane w jedno powiadomienie raz dziennie.</p>
      {body}
      <span role="status" className="muted">{msg}</span>
    </section>
  );
}
