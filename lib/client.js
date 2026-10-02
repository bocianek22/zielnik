// Rozpoznanie natywnej aplikacji (powłoka Capacitor z mobile/). Powłoka dopisuje do user agenta
// „ZielnikApp/<wersja>” (mobile/capacitor.config.js). To nie jest zabezpieczenie (nagłówek można podrobić),
// tylko przełącznik wyglądu: w aplikacji ze sklepu ukrywamy ceny (zasady App Store 1.4.3 / Google Play).
export const NATIVE_UA = /\bZielnikApp\/\d+(\.\d+)*/;

// headers: obiekt Headers (next/headers, Request) albo zwykły obiekt z kluczem 'user-agent'
export function isNativeApp(headers) {
  const ua = typeof headers?.get === 'function' ? headers.get('user-agent') : headers?.['user-agent'];
  return NATIVE_UA.test(String(ua || ''));
}
