'use client';
import { useEffect } from 'react';

// Rejestruje service worker (tylko powłoka offline, patrz public/sw.js)
export default function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
