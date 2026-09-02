import { dateNDaysAgo } from "./date";
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
export function computeStreak(habits: Habit[], logs: HabitLog[]): number {
  // With no habits at all there is nothing to be consistent about: `done >= Math.ceil(0/2)`
  // is `0 >= 0`, always true, which once reported a 120-day streak for an empty checklist.
  const dayTarget = Math.ceil(habits.length / 2);
  if (dayTarget <= 0) return 0;

  // Logs of deleted habits must not count towards this.
  const habitIds = new Set(habits.map((h) => h.id));
  const counts = (log: HabitLog) => log.done && habitIds.has(log.habitId);

  let streak = 0;
  for (let i = 0; i < STREAK_WINDOW_DAYS; i++) {
    const day = dateNDaysAgo(i);
    const done = logs.filter((l) => l.date === day && counts(l)).length;
    if (done >= dayTarget) streak++;
    // Today still being unfinished shouldn't break yesterday's streak.
    else if (i === 0) continue;
    else break;
  }
  return streak;
}
