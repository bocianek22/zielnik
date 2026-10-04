// Rozpoznanie natywnej aplikacji (powłoka Capacitor z mobile/). Powłoka dopisuje do user agenta
// „ZielnikApp/<wersja>” (mobile/capacitor.config.js). To nie jest zabezpieczenie (nagłówek można podrobić),
// tylko przełącznik wyglądu: w aplikacji ze sklepu ukrywamy ceny (zasady App Store 1.4.3 / Google Play).
export const NATIVE_UA = /\bZielnikApp\/\d+(\.\d+)*/;

// headers: obiekt Headers (next/headers, Request) albo zwykły obiekt z kluczem 'user-agent'
export function isNativeApp(headers) {
  const ua = typeof headers?.get === 'function' ? headers.get('user-agent') : headers?.['user-agent'];
  return NATIVE_UA.test(String(ua || ''));
}

// Przybliżony opis urządzenia do listy sesji (POM-27), np. „Chrome, Android”. Pełnego User-Agent nie zapisujemy:
// zawiera wersje i model telefonu, co niepotrzebnie zwiększa ślad urządzenia.
export function describeDevice(ua) {
  const s = String(ua || '').slice(0, 512);
  const os = /Android/.test(s) ? 'Android' : /iPhone|iPod/.test(s) ? 'iPhone' : /iPad/.test(s) ? 'iPad'
    : /CrOS/.test(s) ? 'ChromeOS' : /Windows/.test(s) ? 'Windows' : /Macintosh|Mac OS X/.test(s) ? 'macOS'
      : /Linux/.test(s) ? 'Linux' : '';
  if (NATIVE_UA.test(s)) return `Aplikacja Zielnik${os ? `, ${os}` : ''}`;
  const browser = /Edg(A|iOS)?\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /SamsungBrowser\//.test(s) ? 'Samsung Internet'
    : /Firefox\/|FxiOS\//.test(s) ? 'Firefox' : /Chrome\/|CriOS\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : '';
  return [browser, os].filter(Boolean).join(', ') || 'Nieznane urządzenie';
}
