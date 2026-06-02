/** Next 6:00 local time strictly after `now` (end-of-night boundary for “pause tonight”). */
export function pauseUntilNextEarlyMorning(now: Date = new Date()): number {
  const t = new Date(now);
  t.setHours(6, 0, 0, 0);
  if (t.getTime() <= now.getTime()) {
    t.setDate(t.getDate() + 1);
  }
  return t.getTime();
}

export function pauseUntilHoursFromNow(hours: number, now: Date = new Date()): number {
  return now.getTime() + hours * 3600000;
}

/** Next Monday 6:00 local after `now` — “pause through the weekend.” */
export function pauseUntilNextMondaySix(now: Date = new Date()): number {
  for (let add = 0; add < 14; add++) {
    const t = new Date(now);
    t.setDate(now.getDate() + add);
    t.setHours(6, 0, 0, 0);
    if (t.getDay() === 1 && t.getTime() > now.getTime()) {
      return t.getTime();
    }
  }
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + 7);
  fallback.setHours(6, 0, 0, 0);
  return fallback.getTime();
}
