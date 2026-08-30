export interface Habit {
  id: string;
  label: string;
  hint?: string | null;
  sortOrder: number;
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
