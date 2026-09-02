/**
 * The rule for how far we may trust creker's screen-time number — kept apart from
 * the native bridge in src/integrations/screenTime.ts so it stays a pure function
 * over plain data (and can be exercised without an Android device).
 */

/** The shape this rule needs out of a creker `device_usage` row. */
export interface ScreenTimeRow {
  screenMillis: number;
  /**
   * Epoch millis up to which `screenMillis` is complete for that day — creker's
   * `updated_at`, which is *not* the moment the row was written. `0` means
   * unknown: a creker build older than the column, or a day it never finished
   * measuring.
   */
  updatedAt: number;
}

/**
 * How far behind creker's measurement may lag before it stops speaking for the day.
 * creker syncs in the background and the OS can doze it, so demanding a
 * to-the-minute figure would mean the habit never ticks itself; two hours survives
 * an ordinary doze window while still muting a creker that has actually stalled.
 */
export const FRESHNESS_TOLERANCE_MS = 2 * 60 * 60 * 1000;

export type ScreenTimeVerdict =
  | { action: "tick"; withinLimit: boolean }
  | { action: "skip"; reason: "no-data" | "incomplete" };

/** Local midnight that ends `date` ("yyyy-MM-dd"), i.e. the start of the next day. */
export function endOfLocalDay(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0).getTime();
}

/**
 * What creker's row for `date` actually licenses us to say about the habit.
 *
 * `screenMillis` only ever grows during a day, which makes the two directions
 * unequal. Once it is past the limit the day is spent no matter what happens
 * later, so "over" is safe to act on even from a lagging row. "Under" is a claim
 * about the rest of the day, and a row creker hasn't caught up on doesn't support
 * it — a day it never measured reads as a flat 0, which would otherwise tick
 * "screen time is fine" on a day spent entirely on the phone. So an under-limit
 * row is believed only when creker measured through the point being asked about:
 * now, or the day's end once the day is past.
 */
export function decideScreenTimeHabit(
  row: ScreenTimeRow | undefined,
  limitMin: number,
  nowMs: number,
  date: string,
): ScreenTimeVerdict {
  if (!row) return { action: "skip", reason: "no-data" };

  if (row.screenMillis > limitMin * 60_000) return { action: "tick", withinLimit: false };

  // No stamp at all: nothing was measured, so there is nothing to compare.
  if (!row.updatedAt) return { action: "skip", reason: "incomplete" };

  const measuredThrough = Math.min(nowMs, endOfLocalDay(date));
  if (measuredThrough - row.updatedAt > FRESHNESS_TOLERANCE_MS) {
    return { action: "skip", reason: "incomplete" };
  }
  return { action: "tick", withinLimit: true };
}
