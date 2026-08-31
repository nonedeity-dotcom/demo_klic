import { getCrekerScreenTime } from "../../modules/creker-usage";
import { api } from "../api/client";
import type { Habit } from "../types";

/**
 * Auto-ticks (or un-ticks) today's "screentime" habit from creker's data,
 * if that habit exists and creker actually has a number for today. Silent
 * no-op otherwise — no creker installed, no data synced yet, or the user
 * never added a screen-time habit are all the same "nothing to do" case,
 * not errors. Habits without `auto: "screentime"` are untouched, so the
 * user can still manage everything else (or this one, on days with no
 * creker data) by tapping as usual.
 */
export async function syncScreenTimeHabit(habits: Habit[], date: string): Promise<boolean> {
  const target = habits.find((h) => h.auto === "screentime");
  if (!target) return false;

  const rows = await getCrekerScreenTime(date, date);
  // TEMPORARY diagnostic logging for the E2E investigation — see
  // modules/creker-usage/index.ts for the matching native-call-site logs.
  console.log("[syncScreenTimeHabit] date:", date, "rows:", JSON.stringify(rows));
  const today = rows.find((r) => r.date === date);
  if (!today) return false; // no creker data for today yet — leave it to manual toggling

  const limitMin = await api.getScreenTimeLimitMinutes();
  const withinLimit = today.screenMillis <= limitMin * 60_000;
  console.log("[syncScreenTimeHabit] limitMin:", limitMin, "withinLimit:", withinLimit);
  await api.toggleHabit(target.id, date, withinLimit);
  return true;
}
