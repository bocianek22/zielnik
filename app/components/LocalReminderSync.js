'use client';
import { useEffect } from 'react';
import { getLocalSettings, localSupported, onLocalTap, syncLocal } from './localReminders';

// POM-49: przy każdym otwarciu „Dziś” w APK układa lokalne przypomnienia na tydzień naprzód (dziś bez przypomnienia,
// jeśli wpis objawów już jest), termin recepty i koniec zapasu (POM-51) oraz obsługuje dotknięcie powiadomienia.
// W przeglądarce nic nie robi.
export default function LocalReminderSync({ hasToday = false, rxUntil = null, stockDays = null }) {
  useEffect(() => {
    if (!localSupported()) return undefined;
    const off = onLocalTap();
    (async () => {
      const settings = await getLocalSettings();
      if (!settings.symptoms && !settings.visit && !settings.rx && !settings.stock) return;
      await syncLocal({ hasToday, settings, rxUntil, stockDays });
    })().catch(() => {});
    return off;
  }, [hasToday, rxUntil, stockDays]);
  return null;
}
