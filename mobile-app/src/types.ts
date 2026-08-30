export interface Habit {
  id: string;
  label: string;
  hint?: string | null;
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

export interface RewardOption {
  id: string;
  label: string;
}

export interface Reward {
  id: string;
  date: string;
  text: string;
}
