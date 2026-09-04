import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export interface Countdown {
  secondsLeft: number;
  running: boolean;
  /** True from the first start until it ends or is reset — a pause does not clear it. */
  started: boolean;
  /**
   * Begins counting and returns the wall-clock deadline, or null if there was nothing left.
   *
   * `seconds` overrides what is on the clock. The auto-started break needs it: it arms the
   * next stretch in the same breath as switching to it, and the re-seed that follows a
   * phase change has not landed in state yet.
   */
  start: (seconds?: number) => number | null;
  pause: () => void;
  /** Stops and re-seeds to `seconds`. */
  reset: (seconds: number) => void;
}

/**
 * One countdown, driven by a wall-clock deadline rather than by counting ticks.
 *
 * `setInterval` only fires while JS is running, so a tick-counting timer froze the moment
 * the screen locked — in an app whose whole advice is "put the phone in another room", the
 * fifty minutes never actually elapsed. Here the interval only *renders* the remaining
 * time; the truth is the deadline versus `Date.now()`, which is also why coming back from
 * the background lands on the right number instead of on where it fell asleep.
 *
 * It lives in a hook because the screen now runs two of these — the work/break ring and the
 * boredom clock beside it — and a second hand-rolled copy of this is a second chance to get
 * the background case wrong.
 */
export function useCountdown(totalSeconds: number, onEnd: () => void): Countdown {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const deadlineRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);
  const [started, setStarted] = useState(false);

  // Read through a ref so the ticking effect depends only on `running`. Depending on the
  // callback itself would tear down and rebuild the interval on every render — twice a
  // second while the timer runs.
  const endRef = useRef(onEnd);
  useEffect(() => {
    endRef.current = onEnd;
  }, [onEnd]);

  // An untouched timer shows the length that is actually saved, including right after a
  // stored value first loads. A run in progress is left alone: silently retargeting it
  // would either cut it short or extend it without asking.
  useEffect(() => {
    if (running || startedRef.current) return;
    setSecondsLeft(totalSeconds);
  }, [totalSeconds, running]);

  // Guards against ending twice: React may run a state updater more than once, and the old
  // version of this logged the same focus session twice.
  const endingRef = useRef(false);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    const tick = () => {
      const deadline = deadlineRef.current;
      if (deadline == null) return;
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0 && !endingRef.current) {
        endingRef.current = true;
        deadlineRef.current = null;
        setRunning(false);
        startedRef.current = false;
        setStarted(false);
        endRef.current();
        setTimeout(() => {
          endingRef.current = false;
        }, 0);
      }
    };

    intervalRef.current = setInterval(tick, 500);
    // Catch up immediately on resume instead of waiting for the next tick.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      sub.remove();
    };
  }, [running]);

  const start = useCallback((seconds?: number) => {
    const secs = seconds ?? secondsLeft;
    if (secs <= 0) return null;
    setSecondsLeft(secs);
    const deadline = Date.now() + secs * 1000;
    deadlineRef.current = deadline;
    startedRef.current = true;
    setStarted(true);
    setRunning(true);
    return deadline;
  }, [secondsLeft]);

  const pause = useCallback(() => {
    const deadline = deadlineRef.current;
    if (deadline != null) setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    deadlineRef.current = null;
    setRunning(false);
  }, []);

  const reset = useCallback((seconds: number) => {
    deadlineRef.current = null;
    startedRef.current = false;
    setStarted(false);
    setRunning(false);
    setSecondsLeft(seconds);
  }, []);

  return { secondsLeft, running, started, start, pause, reset };
}
