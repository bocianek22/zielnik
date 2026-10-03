'use client';
import { useEffect } from 'react';

// Odnośnik typu /wiedza#t-limonen (np. z wyszukiwarki) ma rozwinąć wskazany terpen
export default function OpenOnHash() {
  useEffect(() => {
    const open = () => {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el && el.tagName === 'DETAILS') { el.open = true; el.scrollIntoView(); }
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  return null;
}
