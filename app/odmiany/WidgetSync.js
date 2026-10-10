'use client';
import { useEffect, useRef } from 'react';
import { useHome } from '../components/HomeStore';
import { widgetPayload } from '@/lib/widget';
import { widgetSet } from '../components/native/bridge';

// Widżet Androida (POM-13) z listy odmian: „Zużyłem”/„Wykupiłem” na karcie zmienia zapas, a panel „Dziś”
// (który odświeża widżet na stronie głównej) nie jest na tej stronie. Pierwszy stan (zera przed wczytaniem listy) pomijamy.
export default function WidgetSync({ dailyUse, today }) {
  const { stock } = useHome();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    widgetSet(widgetPayload({ stock: { g: stock.g, ml: stock.ml }, dailyUse, today }));
  }, [stock.g, stock.ml, dailyUse, today]);
  return null;
}
