'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

let cache = { path: null, promise: null };

// Mała plakietka z licznikiem w menu (kind: friends | groups | admin)
export default function NavBadge({ kind }) {
  const path = usePathname();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (cache.path !== path) {
      cache = { path, promise: fetch('/api/notifications').then((r) => (r.ok ? r.json() : {})).catch(() => ({})) };
    }
    let alive = true;
    cache.promise.then((d) => alive && setN(d[kind] || 0));
    return () => { alive = false; };
  }, [kind, path]);
  return n > 0 ? <span className="nbadge" aria-label={`${n} nowych`}>{n}</span> : null;
}
