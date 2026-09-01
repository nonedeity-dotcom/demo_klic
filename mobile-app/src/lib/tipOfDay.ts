import { DAILY_TIPS } from "../content/library";
import type { Tip } from "../content/library";

// Fixed reference day. Anything works as long as it never moves — the whole
// point is that "today's tip" is a pure function of the date, so it is the
// same on every launch and doesn't reshuffle when you reopen the app.
const EPOCH_UTC = Date.UTC(2026, 0, 1);

/**
 * The tip for a given local date key ("yyyy-MM-dd"), cycling through the pool
 * in order so nothing repeats until every tip has had its day.
 *
 * Parsed field-by-field and compared in UTC on purpose: `new Date("2026-09-01")`
 * is midnight UTC, and mixing that with a local Date makes the day flip an hour
 * either side of midnight depending on the timezone.
 */
export function tipOfDay(dateKey: string): Tip | null {
  if (DAILY_TIPS.length === 0) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  const days = Math.floor((Date.UTC(y, m - 1, d) - EPOCH_UTC) / 86_400_000);
  const i = ((days % DAILY_TIPS.length) + DAILY_TIPS.length) % DAILY_TIPS.length;
  return DAILY_TIPS[i];
}
