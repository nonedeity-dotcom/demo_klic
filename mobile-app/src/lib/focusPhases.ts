import type { FocusIntervals } from "../api/client";

/**
 * The three states the focus timer can be in.
 *
 * "boredom" is the source material's entry ritual and the reason it exists: ten to twenty
 * minutes of deliberately nothing — no phone, no music, no feed — before the work block,
 * so the first half hour of work isn't spent coming down off the last thing you scrolled.
 * It is a phase rather than a tip because a stretch of boredom is unbearable to guess at
 * and easy to sit through when something else is counting.
 */
export type FocusPhase = "boredom" | "work" | "break";

export const FOCUS_PHASES: FocusPhase[] = ["boredom", "work", "break"];

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

/**
 * What the timer arms itself with once a phase runs out.
 *
 * Boredom is preparation, so it hands over to work. Work has earned the break. A break
 * hands back to work rather than to boredom: the winding-down was for the whole session,
 * and making someone sit through it again between every block is how a ritual turns into
 * a toll. Starting a fresh session from boredom is a tap on the phase itself.
 */
export function nextPhase(phase: FocusPhase): FocusPhase {
  switch (phase) {
    case "boredom":
      return "work";
    case "work":
      return "break";
    case "break":
      return "work";
  }
}

/** Only a finished work block is a focus session — boredom and breaks are not logged. */
export function countsAsSession(phase: FocusPhase): boolean {
  return phase === "work";
}
