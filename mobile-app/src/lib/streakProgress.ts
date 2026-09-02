import { STREAK_MILESTONES } from "../api/client";

export interface MilestoneProgress {
  /** The milestone being worked towards, or null once the last one is passed. */
  next: number | null;
  /** The one already behind you — where the ring starts filling from. */
  previous: number;
  /** 0..1 between those two, for the ring. */
  fraction: number;
}

/**
 * Where the streak sits between the milestone it passed and the next one.
 *
 * Measured from the previous milestone rather than from zero so the ring
 * actually moves: at day 31 of a 66-day target, "from zero" barely twitches
 * for a month, while "since 30" fills visibly every day.
 */
export function milestoneProgress(streak: number): MilestoneProgress {
  const next = STREAK_MILESTONES.find((m) => m > streak) ?? null;
  const previous = [...STREAK_MILESTONES].reverse().find((m) => m <= streak) ?? 0;
  if (next === null) return { next: null, previous, fraction: 1 };
  const span = next - previous;
  return { next, previous, fraction: span > 0 ? Math.min(1, Math.max(0, (streak - previous) / span)) : 0 };
}
