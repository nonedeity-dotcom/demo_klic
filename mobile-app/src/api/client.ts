import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Habit, HabitLog, Trigger, EnergyLog, FocusSession, DailyQuestion, RewardOption, Reward } from "../types";

// Local-only storage: no account, no server. Everything lives in
// AsyncStorage on this device — same idea as the original demo's
// window.storage, just with a native persistence backend. The `api` name
// is kept so screens don't need to change their imports.

const KEYS = {
  habits: "habits-list-v1",
  habitLog: "habit-log-v1",
  triggers: "triggers-list-v1",
  energy: "energy-log-v1",
  sessions: "timer-stats-v1",
  question: "daily-question-v1",
  milestones: "celebrated-milestones-v1",
  rewardOptions: "reward-options-v1",
  rewards: "rewards-log-v1",
  screenTimeLimit: "screen-time-limit-minutes-v1",
};

export const DEFAULT_SCREEN_TIME_LIMIT_MIN = 180; // 3h/day, matches no particular study — just a sane starting point

export const STREAK_MILESTONES = [7, 14, 30, 66];

async function read<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A corrupted/half-written value used to throw out of every query and
    // blank the screen with no way back. Falling back to the default keeps
    // the app usable; the bad value is overwritten on the next write.
    return fallback;
  }
}

async function write<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// Every mutation here is a read-modify-write, and several can be in flight at
// once (the screen-time sync ticking a habit while the user taps another one,
// two quick taps in a row). Without serialising, both read the same array and
// the second write silently discards the first one's change. Queueing per key
// keeps them ordered without blocking unrelated keys.
const writeQueues = new Map<string, Promise<unknown>>();

function withKeyLock<T>(key: string, job: () => Promise<T>): Promise<T> {
  const prev = writeQueues.get(key) ?? Promise.resolve();
  const next = prev.then(job, job);
  // Keep the chain alive but don't let a rejection poison later callers.
  writeQueues.set(
    key,
    next.catch(() => undefined),
  );
  return next;
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}

// Seeded once on first launch so the app isn't empty — there's no "add
// habit/trigger" UI yet, so these are the starting set (drawn from the
// focus/dopamine-detox notes the app is built around).
const DEFAULT_HABITS: Habit[] = [
  { id: uid(), label: "10–20 минут скуки перед стартом работы", hint: "тишина, без экрана, без музыки", sortOrder: 0 },
  { id: uid(), label: "Ритуал входа в фокус", hint: "крепкий чай/кофе — сигнал мозгу", sortOrder: 1 },
  { id: uid(), label: "Телефон — в другой комнате на время работы", sortOrder: 2 },
  { id: uid(), label: "Чёткий дедлайн перед стартом задачи", sortOrder: 3 },
  { id: uid(), label: "10 минут без телефона после блока работы", hint: "50 минут работа / 10 минут отдых", sortOrder: 4 },
  { id: uid(), label: "Час без телефона с утра", sortOrder: 5 },
  { id: uid(), label: "Стакан воды сразу после пробуждения", sortOrder: 6 },
  { id: uid(), label: "Чай без сахара — без резких стимулов с утра", sortOrder: 7 },
  { id: uid(), label: "Без еды в первый час после пробуждения", sortOrder: 8 },
  {
    id: uid(),
    label: "Экранное время в норме",
    hint: "авто из Creker, если установлен — иначе отмечай сам",
    sortOrder: 9,
    auto: "screentime",
  },
];

const DEFAULT_REWARD_OPTIONS: RewardOption[] = [
  { id: uid(), label: "Прогулка" },
  { id: uid(), label: "Чай" },
  { id: uid(), label: "Медитация" },
  { id: uid(), label: "Спорт" },
  { id: uid(), label: "Холодный душ" },
];

const DEFAULT_TRIGGERS: Trigger[] = [
  { id: uid(), label: "Телефон в спальне", removed: false },
  { id: uid(), label: "Уведомления", removed: false },
  { id: uid(), label: "Соцсети сразу после пробуждения", removed: false },
  { id: uid(), label: "Сахар и лишние быстрые стимулы", removed: false },
  { id: uid(), label: "Новости утром", removed: false },
  { id: uid(), label: "Лишние приложения-\"продуктивность\"", removed: false },
];

async function ensureSeeded() {
  if ((await AsyncStorage.getItem(KEYS.habits)) === null) await write(KEYS.habits, DEFAULT_HABITS);
  if ((await AsyncStorage.getItem(KEYS.triggers)) === null) await write(KEYS.triggers, DEFAULT_TRIGGERS);
  if ((await AsyncStorage.getItem(KEYS.rewardOptions)) === null) await write(KEYS.rewardOptions, DEFAULT_REWARD_OPTIONS);
}

export const api = {
  async getHabits(): Promise<Habit[]> {
    await ensureSeeded();
    const habits = await read<Habit[]>(KEYS.habits, []);
    // sortOrder was stored but never actually applied, so the list only looked
    // right because the seed happened to be inserted in order.
    return [...habits].sort((a, b) => a.sortOrder - b.sortOrder);
  },
  async addHabit(label: string, hint?: string): Promise<Habit> {
    return withKeyLock(KEYS.habits, async () => {
      await ensureSeeded();
      const habits = await read<Habit[]>(KEYS.habits, []);
      // Max+1, not length: after any deletion, length collides with an
      // existing sortOrder and two habits fight for the same slot.
      const nextOrder = habits.reduce((max, h) => Math.max(max, h.sortOrder), -1) + 1;
      const habit: Habit = { id: uid(), label, hint: hint ?? null, sortOrder: nextOrder };
      await write(KEYS.habits, [...habits, habit]);
      return habit;
    });
  },
  async updateHabit(id: string, data: { label?: string; hint?: string }): Promise<{ ok: true }> {
    return withKeyLock(KEYS.habits, async () => {
      const habits = await read<Habit[]>(KEYS.habits, []);
      await write(
        KEYS.habits,
        habits.map((h) => (h.id === id ? { ...h, ...data } : h)),
      );
      return { ok: true as const };
    });
  },
  async removeHabit(id: string): Promise<{ ok: true }> {
    await withKeyLock(KEYS.habits, async () => {
      const habits = await read<Habit[]>(KEYS.habits, []);
      await write(
        KEYS.habits,
        habits.filter((h) => h.id !== id),
      );
    });
    // The habit's log entries used to be left behind forever, and everything
    // that counts logs (today's "выполнено N", the streak, the day bars) kept
    // counting them — deleting a ticked habit left the count one too high.
    await withKeyLock(KEYS.habitLog, async () => {
      const logs = await read<HabitLog[]>(KEYS.habitLog, []);
      await write(
        KEYS.habitLog,
        logs.filter((l) => l.habitId !== id),
      );
    });
    return { ok: true };
  },
  async getHabitLog(from: string, to: string): Promise<HabitLog[]> {
    const logs = await read<HabitLog[]>(KEYS.habitLog, []);
    return logs.filter((l) => inRange(l.date, from, to));
  },
  async toggleHabit(habitId: string, date: string, done: boolean): Promise<HabitLog> {
    return withKeyLock(KEYS.habitLog, async () => {
      const logs = await read<HabitLog[]>(KEYS.habitLog, []);
      const existing = logs.find((l) => l.habitId === habitId && l.date === date);
      const entry: HabitLog = existing ? { ...existing, done } : { id: uid(), habitId, date, done };
      await write(KEYS.habitLog, existing ? logs.map((l) => (l === existing ? entry : l)) : [...logs, entry]);
      return entry;
    });
  },

  async getTriggers(): Promise<Trigger[]> {
    await ensureSeeded();
    return read(KEYS.triggers, []);
  },
  async addTrigger(label: string): Promise<Trigger> {
    return withKeyLock(KEYS.triggers, async () => {
      await ensureSeeded();
      const triggers = await read<Trigger[]>(KEYS.triggers, []);
      const trigger: Trigger = { id: uid(), label, removed: false };
      await write(KEYS.triggers, [...triggers, trigger]);
      return trigger;
    });
  },
  async toggleTrigger(triggerId: string, removed: boolean): Promise<{ ok: true }> {
    return withKeyLock(KEYS.triggers, async () => {
      const triggers = await read<Trigger[]>(KEYS.triggers, []);
      await write(
        KEYS.triggers,
        triggers.map((t) => (t.id === triggerId ? { ...t, removed } : t)),
      );
      return { ok: true as const };
    });
  },
  async updateTrigger(id: string, label: string): Promise<{ ok: true }> {
    return withKeyLock(KEYS.triggers, async () => {
      const triggers = await read<Trigger[]>(KEYS.triggers, []);
      await write(
        KEYS.triggers,
        triggers.map((t) => (t.id === id ? { ...t, label } : t)),
      );
      return { ok: true as const };
    });
  },
  async removeTrigger(id: string): Promise<{ ok: true }> {
    return withKeyLock(KEYS.triggers, async () => {
      const triggers = await read<Trigger[]>(KEYS.triggers, []);
      await write(
        KEYS.triggers,
        triggers.filter((t) => t.id !== id),
      );
      return { ok: true as const };
    });
  },

  async getEnergy(from: string, to: string): Promise<EnergyLog[]> {
    const logs = await read<EnergyLog[]>(KEYS.energy, []);
    return logs.filter((l) => inRange(l.date, from, to));
  },
  async setEnergy(date: string, hour: number, value: number): Promise<EnergyLog> {
    return withKeyLock(KEYS.energy, async () => {
      const logs = await read<EnergyLog[]>(KEYS.energy, []);
      const existing = logs.find((l) => l.date === date && l.hour === hour);
      const entry: EnergyLog = { date, hour, value };
      await write(KEYS.energy, existing ? logs.map((l) => (l === existing ? entry : l)) : [...logs, entry]);
      return entry;
    });
  },

  async getSessions(from: string, to: string): Promise<FocusSession[]> {
    const sessions = await read<FocusSession[]>(KEYS.sessions, []);
    return sessions.filter((s) => inRange(s.date, from, to));
  },
  async addSession(date: string, durationMin: number): Promise<FocusSession> {
    return withKeyLock(KEYS.sessions, async () => {
      const sessions = await read<FocusSession[]>(KEYS.sessions, []);
      const session: FocusSession = { id: uid(), date, durationMin, completedAt: new Date().toISOString() };
      await write(KEYS.sessions, [...sessions, session]);
      return session;
    });
  },

  async getQuestion(from: string, to: string): Promise<DailyQuestion[]> {
    const questions = await read<DailyQuestion[]>(KEYS.question, []);
    return questions.filter((q) => inRange(q.date, from, to));
  },
  async setQuestion(date: string, text: string): Promise<DailyQuestion> {
    return withKeyLock(KEYS.question, async () => {
      const questions = await read<DailyQuestion[]>(KEYS.question, []);
      const existing = questions.find((q) => q.date === date);
      const entry: DailyQuestion = { date, text };
      await write(KEYS.question, existing ? questions.map((q) => (q === existing ? entry : q)) : [...questions, entry]);
      return entry;
    });
  },

  async getCelebratedMilestones(): Promise<number[]> {
    return read(KEYS.milestones, []);
  },
  async celebrateMilestone(milestone: number): Promise<void> {
    await withKeyLock(KEYS.milestones, async () => {
      const done = await read<number[]>(KEYS.milestones, []);
      if (!done.includes(milestone)) await write(KEYS.milestones, [...done, milestone]);
    });
  },

  async getRewardOptions(): Promise<RewardOption[]> {
    await ensureSeeded();
    return read(KEYS.rewardOptions, []);
  },
  async addRewardOption(label: string): Promise<RewardOption> {
    return withKeyLock(KEYS.rewardOptions, async () => {
      await ensureSeeded();
      const options = await read<RewardOption[]>(KEYS.rewardOptions, []);
      const option: RewardOption = { id: uid(), label };
      await write(KEYS.rewardOptions, [...options, option]);
      return option;
    });
  },
  async updateRewardOption(id: string, label: string): Promise<{ ok: true }> {
    return withKeyLock(KEYS.rewardOptions, async () => {
      const options = await read<RewardOption[]>(KEYS.rewardOptions, []);
      await write(
        KEYS.rewardOptions,
        options.map((o) => (o.id === id ? { ...o, label } : o)),
      );
      return { ok: true as const };
    });
  },
  async removeRewardOption(id: string): Promise<{ ok: true }> {
    return withKeyLock(KEYS.rewardOptions, async () => {
      const options = await read<RewardOption[]>(KEYS.rewardOptions, []);
      await write(
        KEYS.rewardOptions,
        options.filter((o) => o.id !== id),
      );
      return { ok: true as const };
    });
  },

  async getRewards(from: string, to: string): Promise<Reward[]> {
    const rewards = await read<Reward[]>(KEYS.rewards, []);
    return rewards.filter((r) => inRange(r.date, from, to));
  },
  async addReward(date: string, text: string): Promise<Reward> {
    return withKeyLock(KEYS.rewards, async () => {
      const rewards = await read<Reward[]>(KEYS.rewards, []);
      const reward: Reward = { id: uid(), date, text };
      await write(KEYS.rewards, [...rewards, reward]);
      return reward;
    });
  },

  async getScreenTimeLimitMinutes(): Promise<number> {
    return read(KEYS.screenTimeLimit, DEFAULT_SCREEN_TIME_LIMIT_MIN);
  },
  async setScreenTimeLimitMinutes(minutes: number): Promise<void> {
    await write(KEYS.screenTimeLimit, minutes);
  },
};
