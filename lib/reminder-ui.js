// Wieczorne przypomnienie o objawach działa tylko, gdy serwer sprawdza przypomnienia co godzinę (PUSH_CRON_HOURLY=1, Vercel Pro).
// Bez tego nie da się go nowo włączyć (przełącznik wyłączony z wyjaśnieniem), ale konto, które je już ma włączone,
// może je wyłączyć: wyłączony i zaznaczony przełącznik zostawiłby użytkownika bez wyjścia.
export const HOURLY_NEEDED = 'Wymaga planu z przypomnieniami co godzinę. Na razie serwer sprawdza przypomnienia raz dziennie rano, więc wieczorna godzina nie zadziała.';

// cfg: odpowiedź /api/push/config ({ hourly }), prefs: ustawienia użytkownika ({ notifySymptoms })
export function symptomsSwitchDisabled(cfg, prefs) {
  return !!cfg && !cfg.hourly && !prefs?.notifySymptoms;
}
