'use client';
import { useSyncExternalStore } from 'react';
import { daysSince, lastBackup, markBackup } from '@/lib/last-backup';
import { formatDay } from '@/lib/date';
import { rescheduleBackup } from '../components/localReminders';

const subscribe = (cb) => { window.addEventListener('zielnik:backup', cb); return () => window.removeEventListener('zielnik:backup', cb); };
const dni = (n) => (n === 0 ? 'dziś' : n === 1 ? 'wczoraj' : `${n} dni temu`);

// POM-61: kopia pobrana: zapis dnia na urządzeniu i przełożenie przypomnienia o kopii w APK
export function backupTaken() {
  markBackup();
  rescheduleBackup().catch(() => {});
}

// „Ostatnia kopia na tym urządzeniu: …” (dane tylko z tego urządzenia)
export default function LastBackup() {
  const day = useSyncExternalStore(subscribe, lastBackup, () => null);
  const n = daysSince(day);
  return (
    <p className="muted last-backup" role="status">
      {day ? <>Ostatnia kopia na tym urządzeniu: <b>{formatDay(day)}</b> ({dni(n)}).{n > 30 && ' Warto pobrać nową.'}</>
        : 'Na tym urządzeniu nie pobrano jeszcze kopii danych.'}
    </p>
  );
}
