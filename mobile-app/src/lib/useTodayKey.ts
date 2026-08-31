import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { todayKey } from "./date";

/**
 * Today's local date key, kept current while the screen stays mounted.
 *
 * Screens used to compute the date once per render and never revisit it, so an
 * app left open across midnight kept writing into the previous day — you'd tick
 * a habit at 00:30 and it would land on yesterday. This re-checks when the day
 * actually turns over and whenever the app comes back to the foreground (the
 * common case: phone locked overnight, opened in the morning).
 */
export function useTodayKey(): string {
  const [key, setKey] = useState(todayKey);

  useEffect(() => {
    const sync = () => setKey((prev) => (prev === todayKey() ? prev : todayKey()));

    // Fire just after the next local midnight rather than polling every second.
    const msUntilMidnight = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 500);
      return next.getTime() - now.getTime();
    };

    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      timer = setTimeout(() => {
        sync();
        arm();
      }, msUntilMidnight());
    };
    arm();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });

    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return key;
}
