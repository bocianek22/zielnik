'use client';
import { useEffect, useRef } from 'react';
import { QUEUE_EVENT } from '@/lib/offline-client';

// Słuchacz zdarzeń kolejki offline (sent, rejected, removed, change); handler zawsze najnowszy, bez ponownej rejestracji
export default function useQueueEvents(handler) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    const on = (e) => ref.current(e.detail);
    window.addEventListener(QUEUE_EVENT, on);
    return () => window.removeEventListener(QUEUE_EVENT, on);
  }, []);
}
