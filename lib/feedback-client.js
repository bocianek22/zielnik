import { VERSION } from './version';
import { isDiscreet } from './discreet';
import { isNative } from '../app/components/native/bridge';

// Dane techniczne dołączane do uwagi (tylko w przeglądarce). Serwer i tak zawęża je do białej listy i maskuje ścieżkę.
export function platform() {
  if (isNative()) return 'apk';
  const standalone = (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  return standalone ? 'pwa' : 'przeglądarka';
}

export function collectMeta(screen) {
  const theme = document.documentElement.dataset.theme;
  return {
    version: VERSION,
    path: screen || null,
    platform: platform(),
    theme: theme === 'dark' || theme === 'light' ? theme : 'auto',
    discreet: isDiscreet(),
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}

// Ekran, z którego przyszło zgłoszenie: z adresu (?ekran=) albo z poprzedniej strony tej samej witryny
export function referrerPath() {
  try {
    const u = new URL(document.referrer);
    return u.origin === location.origin && !u.pathname.startsWith('/uwagi') ? u.pathname : null;
  } catch {
    return null;
  }
}
