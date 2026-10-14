import { addDaysIso } from './date.js';

// Czysta część serii wpisów objawów (POM-08); SQL w lib/streak.js.
export const WEEK = 7;

// `days`: dni „RRRR-MM-DD” z wpisem, `today`: dzień polski. Zwraca { streak, week, weekCount }.
// Brak dzisiejszego wpisu nie zeruje serii (dzień jeszcze trwa): wtedy liczymy do wczoraj.
// week: 7 ostatnich dni od najstarszego do dziś, { day, on }.
export function buildStreak(days, today) {
  const set = new Set(days);
  let d = set.has(today) ? today : addDaysIso(today, -1);
  let streak = 0;
  while (set.has(d)) { streak++; d = addDaysIso(d, -1); }
  const week = Array.from({ length: WEEK }, (_, i) => {
    const day = addDaysIso(today, i - (WEEK - 1));
    return { day, on: set.has(day) };
  });
  return { streak, week, weekCount: week.filter((x) => x.on).length };
}
