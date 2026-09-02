import { getCrekerScreenTime } from "../../modules/creker-usage";
import { api } from "../api/client";
import { decideScreenTimeHabit } from "../lib/screenTime";
import type { Habit } from "../types";

/**
 * Auto-ticks (or un-ticks) the "screentime" habit for `date` from creker's data,
 * if that habit exists and creker's number for the day is one we can stand behind
 * — see decideScreenTimeHabit for that rule. Silent no-op otherwise: no creker
 * installed, nothing synced yet, a row creker hasn't caught up on, or no
 * screen-time habit are all the same "nothing to do" case, not errors. Habits
 * without `auto: "screentime"` are untouched, so everything else — and this one,
 * on days creker can't speak for — stays manual.
 *
 * Returns whether the habit's state was actually set from creker's data.
 */
export async function syncScreenTimeHabit(habits: Habit[], date: string): Promise<boolean> {
  const target = habits.find((h) => h.auto === "screentime");
  if (!target) return false;

  const rows = await getCrekerScreenTime(date, date);
  const row = rows.find((r) => r.date === date);
  if (!row) return false;

  const limitMin = await api.getScreenTimeLimitMinutes();
  const verdict = decideScreenTimeHabit(row, limitMin, Date.now(), date);
  if (verdict.action !== "tick") return false;

  await api.toggleHabit(target.id, date, verdict.withinLimit);
  return true;
}
