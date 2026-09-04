import type { FocusIntervals } from "../api/client";

/**
 * Everything that can run a clock and ring at the end of it.
 *
 * "boredom" is the source material's entry ritual: ten to twenty minutes of deliberately
 * nothing — no phone, no music, no feed — before the work block, so the first half hour of
 * work isn't spent coming down off the last thing you scrolled. It has a clock rather than
 * a tip because a stretch of boredom is unbearable to guess at and easy to sit through when
 * something else is counting.
 *
 * It runs on its own timer, though, which is what CYCLE_PHASES below is about.
 */
export type FocusPhase = "boredom" | "work" | "break";

export const FOCUS_PHASES: FocusPhase[] = ["boredom", "work", "break"];

/**
 * The two that take turns on the main ring.
 *
 * Boredom is deliberately not one of them. Sitting through a wind-down is something you do
 * once, before a session — folding it into the loop would make every break hand over to
 * another fifteen minutes of staring at a wall, which is how a ritual turns into a toll.
 * So it gets its own clock, started on its own, ending on its own.
 */
export type CyclePhase = "work" | "break";

export const CYCLE_PHASES: CyclePhase[] = ["work", "break"];

export const PHASE_LABELS: Record<FocusPhase, string> = {
  boredom: "скука",
  work: "работа",
  break: "перерыв",
};

/** The line above the ring — what this stretch is for, not just what it is called. */
export const PHASE_CAPTIONS: Record<FocusPhase, string> = {
  boredom: "Разгрузка",
  work: "Погружение",
  break: "Офлайн-прогресс",
};

export const PHASE_FIELDS: Record<FocusPhase, keyof FocusIntervals> = {
  boredom: "boredomMin",
  work: "workMin",
  break: "breakMin",
};

export const MIN_PHASE_MIN = 1;
export const MAX_PHASE_MIN = 240;

export function phaseMinutes(intervals: FocusIntervals, phase: FocusPhase): number {
  return intervals[PHASE_FIELDS[phase]];
}

export function clampPhaseMinutes(value: number): number {
  if (!Number.isFinite(value)) return MIN_PHASE_MIN;
  return Math.min(MAX_PHASE_MIN, Math.max(MIN_PHASE_MIN, Math.trunc(value)));
}

/** What the main ring arms itself with once the current stretch runs out. */
export function nextCyclePhase(phase: CyclePhase): CyclePhase {
  return phase === "work" ? "break" : "work";
}

/**
 * Whether the next stretch should start counting by itself.
 *
 * Only after work. A break is the thing you are least likely to be holding the phone for,
 * and having to come back and press start is exactly how a five-minute break becomes
 * twenty. The other direction is the opposite: auto-starting a work block while the phone
 * is still face-down in another room would burn the block on an empty room.
 */
export function autoStartsNext(phase: CyclePhase): boolean {
  return phase === "work";
}

/** Only a finished work block is a focus session — boredom and breaks are not logged. */
export function countsAsSession(phase: FocusPhase): boolean {
  return phase === "work";
}

/**
 * How long the end-of-stretch sound keeps going before it gives up on its own.
 *
 * A chime that rings until dismissed is a chime that rings across a room you have left. Ten
 * seconds is long enough to hear from the next room and short enough that nobody has to
 * come back and silence it.
 */
export const RING_TIMEOUT_MS = 10_000;
