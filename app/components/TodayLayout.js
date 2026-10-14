'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { TODAY_CARDS } from '@/lib/today-cards';

// POM-48: które karty pokazać na „Dziś” (zapis na koncie, więc działa też po zmianie telefonu). Kafle, „Do zrobienia”
// i pilne recepty zostają zawsze. Zmiana działa od razu; przy błędzie zapisu przełącznik wraca.
export default function TodayLayout({ hidden, onChange }) {
  const [err, setErr] = useState('');
  async function toggle(key, show) {
    const prev = hidden;
    const next = show ? hidden.filter((k) => k !== key) : [...hidden, key];
    onChange(next); setErr('');
    try { onChange((await api('/api/today-layout', 'PUT', { hidden: next })).hidden); } catch (e) { onChange(prev); setErr(e.message); }
  }
  return (
    <fieldset className="today-layout">
      <legend className="prefs-title">Pokaż na ekranie „Dziś”</legend>
      {TODAY_CARDS.map((c) => (
        <label key={c.key} className="check">
          <input type="checkbox" checked={!hidden.includes(c.key)} onChange={(e) => toggle(c.key, e.target.checked)} /> {c.label}
        </label>
      ))}
      <p className="muted small">Kafle, lista „Do zrobienia” i pilne przypomnienia o recepcie są zawsze widoczne.</p>
      {err && <p className="alert error" role="alert">{err}</p>}
    </fieldset>
  );
}
