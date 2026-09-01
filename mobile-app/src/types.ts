export interface Habit {
  id: string;
  label: string;
  hint?: string | null;
  /**
   * The cut-down version for bad days — step 4 of the source's "точка
   * возврата" protocol. Declared in advance on purpose: on the day you
   * actually need it, you won't invent one.
   */
  minimal?: string | null;
  sortOrder: number;
  /** When set, this habit's done-state for today is managed automatically
   *  instead of by tapping — currently only "screentime" (from creker), see
   *  src/integrations/screenTime.ts. */
  auto?: "screentime" | null;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string; // ISO date
  done: boolean;
  /**
   * True when the day was closed with the minimal version rather than the
   * full one. Still counts for the streak — the source's whole point is that
   * a small day beats a broken chain — but the report shows the difference so
   * a month of minimums doesn't read as a month of full days.
   */
  minimal?: boolean;
}

export interface Trigger {
  id: string;
  label: string;
  removed: boolean;
}

export interface EnergyLog {
  date: string;
  hour: number;
  value: number;
}

export interface FocusSession {
  id: string;
  date: string;
  durationMin: number;
  completedAt: string;
}

export interface DailyQuestion {
  date: string;
  text: string;
}

/**
 * Step 5 of the "точка возврата" protocol: once a week, on a calm head,
 * look at what worked and change one thing. Stored per ISO week rather than
 * per date so a review written on Sunday and one written on Monday morning
 * don't become two separate weeks.
 */
export interface WeeklyReview {
  /** "2026-W35" — see src/lib/week.ts. */
  week: string;
  worked: string;
  didnt: string;
  change: string;
  /** Local date the review was written, for the history list. */
  date: string;
}

export interface RewardOption {
  id: string;
  label: string;
}

export interface Reward {
  id: string;
  date: string;
  text: string;
}
