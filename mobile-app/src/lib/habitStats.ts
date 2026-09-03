import { dateNDaysAgo } from "./date";
import { habitTarget, logCount, perDayTarget } from "./habits";
import { weekKey } from "./week";
import type { Habit, HabitLog } from "../types";

/** As far back as a single habit's history is walked — same window as the global streak. */
export const HABIT_WINDOW_DAYS = 120;

export interface HabitStats {
  /** Days in a row for a daily habit, weeks in a row for a weekly one. */
  streak: number;
  /** "дней" or "недель" — the unit `streak` is counted in. */
  unit: "days" | "weeks";
  /** The first day it was actually done, or null if it never has been. */
  firstDay: string | null;
  /** Calendar days from `firstDay` to today, inclusive. 0 when it never started. */
  daysSinceStart: number;
  /** The last seven days, oldest first — the strip shown beside the name. */
  week: boolean[];
}

function doneOn(habit: Habit, logs: HabitLog[], date: string): boolean {
  const log = logs.find((l) => l.habitId === habit.id && l.date === date);
  return logCount(log) >= perDayTarget(habit);
}

/**
 * How long this one habit has been running, on its own terms.
 *
 * The global streak answers "did the whole system hold today", which is a different
 * question and the reason this exists: a habit added a week into a 40-day streak inherits
 * that 40 and looks settled when it is three days old.
 *
 * A frozen day is skipped rather than counted — the freeze is a day off from everything,
 * so it should not break a single habit either, and it did not earn a tick.
 */
export function habitStreakDays(habit: Habit, logs: HabitLog[], frozen: string[] = []): number {
  const frozenDays = new Set(frozen);
  let streak = 0;
  for (let i = 0; i < HABIT_WINDOW_DAYS; i++) {
    const day = dateNDaysAgo(i);
    if (doneOn(habit, logs, day)) streak++;
    // Today still being open shouldn't break yesterday's run.
    else if (i === 0) continue;
    else if (frozenDays.has(day)) continue;
    else break;
  }
  return streak;
}

/**
 * Weeks in a row a weekly habit met its target. Counting its days would be meaningless —
 * "спорт 3 раза в неделю" is never a run of consecutive days.
 *
 * The current week is never counted as a failure: it isn't over yet.
 */
export function habitStreakWeeks(habit: Habit, logs: HabitLog[]): number {
  const target = habitTarget(habit).count;
  const doneByWeek = new Map<string, number>();
  for (const l of logs) {
    if (l.habitId !== habit.id || !l.done) continue;
    const key = weekKey(l.date);
    doneByWeek.set(key, (doneByWeek.get(key) ?? 0) + 1);
  }

  const thisWeek = weekKey(dateNDaysAgo(0));
  let streak = 0;
  for (let i = 0; i * 7 < HABIT_WINDOW_DAYS; i++) {
    const key = weekKey(dateNDaysAgo(i * 7));
    const met = (doneByWeek.get(key) ?? 0) >= target;
    if (met) streak++;
    else if (key === thisWeek) continue;
    else break;
  }
  return streak;
}

/** The first day this habit was actually done — its real start, not when it was typed in. */
export function habitFirstDay(habit: Habit, logs: HabitLog[]): string | null {
  let first: string | null = null;
  for (const l of logs) {
    if (l.habitId !== habit.id || !l.done) continue;
    if (first === null || l.date < first) first = l.date;
  }
  return first;
}

/** Calendar days from `from` to `to`, inclusive — "23-й день" counts the first one. */
export function daysBetweenInclusive(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = new Date(fy, fm - 1, fd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000) + 1);
}

export function habitStats(habit: Habit, logs: HabitLog[], today: string, frozen: string[] = []): HabitStats {
  const weekly = habitTarget(habit).kind === "weekly";
  const firstDay = habitFirstDay(habit, logs);
  return {
    streak: weekly ? habitStreakWeeks(habit, logs) : habitStreakDays(habit, logs, frozen),
    unit: weekly ? "weeks" : "days",
    firstDay,
    daysSinceStart: firstDay ? daysBetweenInclusive(firstDay, today) : 0,
    week: Array.from({ length: 7 }, (_, i) => doneOn(habit, logs, dateNDaysAgo(6 - i))),
  };
}
