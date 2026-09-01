import { toDateKey } from "./date";
import { weekStart } from "./week";
import type { Habit, HabitLog } from "../types";

export type DayState = "full" | "minimal" | "missed" | "future";

export interface GridDay {
  date: string;
  state: DayState;
  isToday: boolean;
}

export const GRID_WEEKS = 4;

/**
 * Four weeks of days, aligned to Monday columns.
 *
 * Aligned rather than "the last 28 days" so the columns are weekdays: a
 * column of gaps under вс says something a rolling window can't. Days after
 * today are rendered as future rather than as misses.
 */
export function buildMonthGrid(today: string, habits: Habit[], logs: HabitLog[]): GridDay[] {
  const target = Math.ceil(habits.length / 2);
  const habitIds = new Set(habits.map((h) => h.id));

  const byDate = new Map<string, { done: number; full: number }>();
  for (const l of logs) {
    if (!l.done || !habitIds.has(l.habitId)) continue;
    const acc = byDate.get(l.date) ?? { done: 0, full: 0 };
    acc.done += 1;
    if (!l.minimal) acc.full += 1;
    byDate.set(l.date, acc);
  }

  // Monday of the week that started GRID_WEEKS-1 weeks ago.
  const [y, m, d] = weekStart(today).split("-").map(Number);
  const start = new Date(y, m - 1, d);
  start.setDate(start.getDate() - (GRID_WEEKS - 1) * 7);

  const days: GridDay[] = [];
  for (let i = 0; i < GRID_WEEKS * 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = toDateKey(date);
    const counts = byDate.get(key);
    let state: DayState;
    if (key > today) state = "future";
    else if (target === 0 || !counts || counts.done < target) state = "missed";
    // "По минимуму" means the day only reached the target because minimal
    // ticks counted — not merely that one of its ticks was a small one.
    else state = counts.full >= target ? "full" : "minimal";
    days.push({ date: key, state, isToday: key === today });
  }
  return days;
}

export function countedDays(days: GridDay[]): number {
  return days.filter((d) => d.state === "full" || d.state === "minimal").length;
}

/** Counted days this week minus counted days the week before. */
export function weekOverWeek(days: GridDay[]): number | null {
  if (days.length < 14) return null;
  const thisWeek = days.slice(-7);
  const lastWeek = days.slice(-14, -7);
  // A week still in progress can't be compared with a finished one without
  // flattering itself, so only count the days that have actually happened.
  const elapsed = thisWeek.filter((d) => d.state !== "future").length;
  if (elapsed === 0) return null;
  return countedDays(thisWeek) - countedDays(lastWeek.slice(0, elapsed));
}
