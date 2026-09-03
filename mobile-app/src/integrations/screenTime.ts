import { getCrekerScreenTime } from "../../modules/creker-usage";
import { api } from "../api/client";
import { perDayTarget } from "../lib/habits";
import { decideScreenTimeHabit } from "../lib/screenTime";
import type { Habit, HabitLog } from "../types";

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

  // A day the person set by hand is theirs: unticking "экранное время в норме" used to last
  // only until the next visit to the tab, when this sync quietly put it back.
  const logs = (await api.getHabitLog(date, date)) as HabitLog[];
  if (logs.some((l) => l.habitId === target.id && l.manual)) return false;

  const rows = await getCrekerScreenTime(date, date);
  const row = rows.find((r) => r.date === date);
  if (!row) return false;

  const limitMin = await api.getScreenTimeLimitMinutes();
  const verdict = decideScreenTimeHabit(row, limitMin, Date.now(), date);
  if (verdict.action !== "tick") return false;

  // The auto habit is a plain yes/no, so its day is written straight to full or empty
  // rather than stepped: creker's answer is not a tap.
  const perDay = perDayTarget(target);
  await api.setHabitProgress(target.id, date, verdict.withinLimit ? perDay : 0, perDay);
  return true;
}
