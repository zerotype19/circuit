import type { AnchorSlotKind } from "../types";

export type SignalSlot =
  | { id: string; kind: AnchorSlotKind; schedule: "daily"; hour: number; minute: number }
  | { id: string; kind: AnchorSlotKind; schedule: "weekly"; weekday: number; hour: number; minute: number };

/**
 * Expo weekly `weekday`: 1 = Sunday … 7 = Saturday.
 * Anchors follow the product brief (local device timezone).
 * Fewer, sharper beats: morning frame, evening closure, Sunday scaries, late-night spiral.
 */
export const SIGNAL_SLOTS: SignalSlot[] = [
  { id: "morning", kind: "morning", schedule: "daily", hour: 8, minute: 15 },
  { id: "evening", kind: "evening", schedule: "daily", hour: 20, minute: 15 },
  { id: "sunday", kind: "sunday", schedule: "weekly", weekday: 1, hour: 19, minute: 30 },
  { id: "lateNight", kind: "lateNight", schedule: "daily", hour: 23, minute: 0 },
];

function cloneDate(d: Date): Date {
  return new Date(d.getTime());
}

/** Next calendar occurrence of a daily wall-clock time (device local). */
function nextDailyOccurrence(hour: number, minute: number, from: Date): Date {
  const t = cloneDate(from);
  t.setSeconds(0, 0);
  const out = cloneDate(t);
  out.setHours(hour, minute, 0, 0);
  if (out.getTime() <= from.getTime()) {
    out.setDate(out.getDate() + 1);
  }
  return out;
}

/** Expo weekday 1–7 (1 = Sunday). JS getDay(): 0 Sun … 6 Sat → expo = getDay() + 1 except map 0→1 already. */
function jsDayToExpoWeekday(js: number): number {
  return js === 0 ? 1 : js + 1;
}

/** Next occurrence of weekly slot after `from` (same local time). Expo weekday 1–7 (1 = Sunday). */
function nextWeeklyOccurrence(
  expoWeekday: number,
  hour: number,
  minute: number,
  from: Date
): Date {
  for (let i = 0; i < 14; i++) {
    const tryDate = cloneDate(from);
    tryDate.setDate(from.getDate() + i);
    tryDate.setHours(hour, minute, 0, 0);
    if (jsDayToExpoWeekday(tryDate.getDay()) !== expoWeekday) {
      continue;
    }
    if (tryDate.getTime() > from.getTime()) {
      return tryDate;
    }
  }
  const fallback = cloneDate(from);
  fallback.setDate(fallback.getDate() + 7);
  fallback.setHours(hour, minute, 0, 0);
  return fallback;
}

/** Next wall-clock firing of this slot after `from` (device local). */
export function nextFireDateForSlot(slot: SignalSlot, from: Date): Date {
  if (slot.schedule === "daily") {
    return nextDailyOccurrence(slot.hour, slot.minute, from);
  }
  return nextWeeklyOccurrence(slot.weekday, slot.hour, slot.minute, from);
}

export function nextSignalAfter(from: Date = new Date()): { at: Date; slot: SignalSlot } | null {
  let best: { at: Date; slot: SignalSlot } | null = null;
  for (const slot of SIGNAL_SLOTS) {
    const at = nextFireDateForSlot(slot, from);
    if (!best || at.getTime() < best.at.getTime()) {
      best = { at, slot };
    }
  }
  return best;
}

export function formatNextSignalLine(at: Date): string {
  return at.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dayModeLabel(now: Date = new Date()): "Weekend" | "Workday" {
  const d = now.getDay();
  return d === 0 || d === 6 ? "Weekend" : "Workday";
}
