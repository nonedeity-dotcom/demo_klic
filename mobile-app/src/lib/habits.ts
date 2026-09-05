import type { Habit, HabitLog, HabitTarget, ItemGroup } from "../types";

/** What a habit meant before targets existed, and what a new one starts as. */
export const DEFAULT_TARGET: HabitTarget = { kind: "daily", count: 1 };

/** 1..12 — below one a habit could never be met, above twelve it stops being a habit. */
export const MAX_TARGET_COUNT = 12;

/**
 * Which pile something is in. Takes anything carrying a group — habits and triggers use the
 * same three piles — so the two screens can't drift on what an absent group means.
 */
export function itemGroup(item: { group?: ItemGroup }): ItemGroup {
  return item.group ?? "now";
}

export function habitGroup(habit: Habit): ItemGroup {
  return itemGroup(habit);
}

export function habitTarget(habit: Habit): HabitTarget {
  const t = habit.target;
  if (!t || (t.kind !== "daily" && t.kind !== "weekly")) return DEFAULT_TARGET;
  const count = Math.min(MAX_TARGET_COUNT, Math.max(1, Math.round(t.count)));
  return { kind: t.kind, count };
}

/**
 * How many taps close this habit on a single day.
 *
 * A weekly habit is one-a-day: "спорт 3 раза в неделю" means three *days* with training in
 * them, not three sessions crammed into one. Its count lives across the week instead.
 */
export function perDayTarget(habit: Habit): number {
  const t = habitTarget(habit);
  return t.kind === "daily" ? t.count : 1;
}

/** Rows written before counters existed have no count — a done day was one done. */
export function logCount(log: HabitLog | undefined): number {
  if (!log) return 0;
  if (typeof log.count === "number" && Number.isFinite(log.count)) return Math.max(0, Math.trunc(log.count));
  return log.done ? 1 : 0;
}

/** Progress on `date`, as the row shows it: "1 из 3". */
export function dayProgress(habit: Habit, logs: HabitLog[], date: string): { count: number; target: number } {
  const log = logs.find((l) => l.habitId === habit.id && l.date === date);
  return { count: logCount(log), target: perDayTarget(habit) };
}

/** Days with this habit done, inside the given dates — the week view for a weekly habit. */
export function weeklyProgress(habit: Habit, logs: HabitLog[], dates: string[]): { count: number; target: number } {
  const days = new Set(dates);
  const count = logs.filter((l) => l.habitId === habit.id && days.has(l.date) && l.done).length;
  return { count, target: habitTarget(habit).count };
}

/**
 * The habits a day is judged against: the ones being introduced now, counted daily, and
 * already in the checklist on that day.
 *
 * "Дополнительно" is done for the record and "потом" is a plan, so neither can fail a day.
 * Weekly habits are left out too — they would fail every day that isn't a training day.
 *
 * The date is what stops a new habit from re-judging the past. Without it the streak walked
 * backwards asking "was everything on today's list done?" — so adding one habit found
 * yesterday missing a mark that could not possibly exist and broke a chain of eleven days.
 * A habit answers only for the days it was actually there for.
 */
export function habitsThatDecideTheDay(habits: Habit[], date?: string): Habit[] {
  return habits.filter(
    (h) =>
      habitGroup(h) === "now" &&
      habitTarget(h).kind === "daily" &&
      (date === undefined || !h.createdAt || h.createdAt <= date),
  );
}
