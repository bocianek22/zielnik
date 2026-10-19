'use client';
import { api } from '@/lib/api';
import { plugin, listen } from './native/bridge';
import { planLocal, parseLocalSettings, ALL_IDS } from '@/lib/local-reminders';
import { lastBackup } from '@/lib/last-backup';

// POM-49: lokalne przypomnienia w APK przez @capacitor/local-notifications (powłoka mobile/ od 0.6.0). W przeglądarce
// i w starszym APK wtyczki nie ma: wszystkie funkcje nic nie robią. Ustawienia zostają na tym telefonie (Preferences).
const KEY = 'zielnik.localrem';
const LN = () => plugin('LocalNotifications');

export const localSupported = () => !!LN();

export async function getLocalSettings() {
  const P = plugin('Preferences');
  if (!P) return parseLocalSettings(null);
  try { return parseLocalSettings((await P.get({ key: KEY }))?.value); } catch { return parseLocalSettings(null); }
}

export async function setLocalSettings(s) {
  await plugin('Preferences')?.set({ key: KEY, value: JSON.stringify(s) });
}

// true, gdy system pozwala pokazywać powiadomienia (Android 13+ pyta raz)
export async function ensurePermission() {
  const L = LN();
  if (!L) return false;
  let p = await L.checkPermissions();
  if (p.display === 'prompt' || p.display === 'prompt-with-rationale') p = await L.requestPermissions();
  return p.display === 'granted';
}

// Układa przypomnienia od nowa: najpierw usuwa wszystkie nasze, potem planuje według ustawień.
// hasToday: dziś jest już wpis objawów (bez dzisiejszego przypomnienia); nextVisit: data wizyty z ustawień konta.
// Ostatnio znane z „Dziś” dane do przypomnień o recepcie i zapasie (POM-51): ponowne ułożenie z innego ekranu ich nie gubi
const CTX = 'zielnik.localrem.ctx';
async function context(patch) {
  const P = plugin('Preferences');
  let ctx = {};
  try { ctx = JSON.parse((await P?.get({ key: CTX }))?.value || '{}') || {}; } catch { ctx = {}; }
  if (patch) { ctx = { ...ctx, ...patch }; await P?.set({ key: CTX, value: JSON.stringify(ctx) }).catch(() => {}); }
  return ctx;
}

// nextVisit pominięte: dociągane z ustawień konta, gdy przypomnienie o wizycie jest włączone.
// rxUntil, stockDays pominięte: ostatnio zapamiętane (podaje je ekran „Dziś”).
export async function syncLocal({ hasToday = false, nextVisit, settings = null, rxUntil, stockDays } = {}) {
  const L = LN();
  if (!L) return;
  const s = settings ?? await getLocalSettings();
  const given = {};
  if (rxUntil !== undefined) given.rxUntil = rxUntil;
  if (stockDays !== undefined) given.stockDays = stockDays;
  const ctx = await context(Object.keys(given).length ? given : null);
  if (nextVisit === undefined) nextVisit = s.visit ? (await api('/api/push/config').catch(() => null))?.prefs?.nextVisit ?? null : null;
  await L.cancel({ notifications: ALL_IDS.map((id) => ({ id })) }).catch(() => {});
  const plan = planLocal({ settings: s, hasToday, nextVisit, rxUntil: ctx.rxUntil ?? null, stockDays: ctx.stockDays ?? null, lastBackup: lastBackup() });
  if (!plan.length) return;
  await L.schedule({
    notifications: plan.map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true }, extra: { url: n.url } })),
  });
}

// Dotknięcie powiadomienia otwiera wskazany ekran (tylko adresy wewnętrzne)
export function onLocalTap() {
  return listen('LocalNotifications', 'localNotificationActionPerformed', (e) => {
    const url = e?.notification?.extra?.url;
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')) window.location.href = url;
  });
}
