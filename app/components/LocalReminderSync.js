'use client';
import { useEffect } from 'react';
import { getLocalSettings, localSupported, onLocalTap, syncLocal } from './localReminders';

// POM-49: przy każdym otwarciu „Dziś” w APK układa lokalne przypomnienia na tydzień naprzód (dziś bez przypomnienia,
// jeśli wpis objawów już jest) i obsługuje dotknięcie powiadomienia. W przeglądarce nic nie robi.
export default function LocalReminderSync({ hasToday = false }) {
  useEffect(() => {
    if (!localSupported()) return undefined;
    const off = onLocalTap();
    (async () => {
      const settings = await getLocalSettings();
      if (!settings.symptoms && !settings.visit) return;
      await syncLocal({ hasToday, settings });
    })().catch(() => {});
    return off;
  }, [hasToday]);
  return null;
}
