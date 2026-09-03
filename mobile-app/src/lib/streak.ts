import { dateNDaysAgo } from "./date";
import { weekKey } from "./week";
import type { Habit, HabitLog } from "../types";

/** How far back a streak is counted — comfortably past the 66-day mark. */
export const STREAK_WINDOW_DAYS = 120;

/**
 * Days in a row where at least half the habits were done.
 *
 * Lives here rather than inside the report because two screens now show it (the report's
 * ring and bar, and the Этапы screen), and a second hand-rolled copy would drift: the
 * "deleted habits don't count" and "an empty checklist has no streak" rules below are both
 * bugs that were fixed once already.
 */
/** Whether a single day met the bar: at least half the habits done. */
export function dayCounts(habits: Habit[], logs: HabitLog[], date: string): boolean {
  const dayTarget = Math.ceil(habits.length / 2);
  if (dayTarget <= 0) return false;
  const habitIds = new Set(habits.map((h) => h.id));
  return logs.filter((l) => l.date === date && l.done && habitIds.has(l.habitId)).length >= dayTarget;
}

export function computeStreak(habits: Habit[], logs: HabitLog[], frozen: string[] = []): number {
  // With no habits at all there is nothing to be consistent about: `done >= Math.ceil(0/2)`
  // is `0 >= 0`, always true, which once reported a 120-day streak for an empty checklist.
  const dayTarget = Math.ceil(habits.length / 2);
  if (dayTarget <= 0) return 0;

  // Logs of deleted habits must not count towards this.
  const habitIds = new Set(habits.map((h) => h.id));
  const counts = (log: HabitLog) => log.done && habitIds.has(log.habitId);

  const frozenDays = new Set(frozen);

  let streak = 0;
  for (let i = 0; i < STREAK_WINDOW_DAYS; i++) {
    const day = dateNDaysAgo(i);
    const done = logs.filter((l) => l.date === day && counts(l)).length;
    if (done >= dayTarget) streak++;
    // Today still being unfinished shouldn't break yesterday's streak.
    else if (i === 0) continue;
    // A frozen day neither breaks the chain nor adds to it. Counting it as a day would be
    // a lie about how many days were actually done; breaking on it is the cliff the freeze
    // exists to remove.
    else if (frozenDays.has(day)) continue;
    else break;
  }
  return streak;
}

/** One skipped day a week may be frozen instead of breaking the chain. */
export const FREEZES_PER_WEEK = 1;

/**
 * The day that should be frozen right now, or null.
 *
 * Only ever yesterday, and only when there was a chain to protect: a gap older than that has
 * already broken the streak, and rescuing it retroactively would mean the number changed
 * under someone who had already seen it. Two missed days in a row are a real break —
 * yesterday's freeze cannot cover the day before it as well.
 */
export function freezeCandidate(
  habits: Habit[],
  logs: HabitLog[],
  frozen: string[],
  today: string,
): string | null {
  if (habits.length === 0) return null;

  const yesterday = dateNDaysAgo(1);
  const beforeYesterday = dateNDaysAgo(2);
  if (dayCounts(habits, logs, yesterday)) return null;

  const frozenDays = new Set(frozen);
  if (frozenDays.has(yesterday)) return null;
  // Nothing to save: the chain was already broken the day before.
  if (!dayCounts(habits, logs, beforeYesterday) && !frozenDays.has(beforeYesterday)) return null;
  // One a week, counted in the week the skipped day falls in.
  const week = weekKey(yesterday);
  if (frozen.filter((d) => weekKey(d) === week).length >= FREEZES_PER_WEEK) return null;

  return yesterday;
}
