import { NextResponse } from 'next/server';
import { requireUser, safe } from '@/lib/guard';
import { getPrefs, pushConfig } from '@/lib/push';

// Publiczny klucz VAPID (do pushManager.subscribe) i ustawienia przypomnień zalogowanego użytkownika
export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ ...pushConfig(), prefs: await getPrefs(user.id) });
});
