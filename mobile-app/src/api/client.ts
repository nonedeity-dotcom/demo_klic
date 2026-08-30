import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Habit, HabitLog, Trigger, EnergyLog, FocusSession, DailyQuestion } from "../types";

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
};

async function read<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

async function write<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
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
}

export const api = {
  async getHabits(): Promise<Habit[]> {
    await ensureSeeded();
    return read(KEYS.habits, []);
  },
  async addHabit(label: string, hint?: string): Promise<Habit> {
    const habits = await read<Habit[]>(KEYS.habits, []);
    const habit: Habit = { id: uid(), label, hint: hint ?? null, sortOrder: habits.length };
    await write(KEYS.habits, [...habits, habit]);
    return habit;
  },
  async updateHabit(id: string, data: { label?: string; hint?: string }): Promise<{ ok: true }> {
    const habits = await read<Habit[]>(KEYS.habits, []);
    await write(
      KEYS.habits,
      habits.map((h) => (h.id === id ? { ...h, ...data } : h)),
    );
    return { ok: true };
  },
  async removeHabit(id: string): Promise<{ ok: true }> {
    const habits = await read<Habit[]>(KEYS.habits, []);
    await write(
      KEYS.habits,
      habits.filter((h) => h.id !== id),
    );
    return { ok: true };
  },
  async getHabitLog(from: string, to: string): Promise<HabitLog[]> {
    const logs = await read<HabitLog[]>(KEYS.habitLog, []);
    return logs.filter((l) => inRange(l.date, from, to));
  },
  async toggleHabit(habitId: string, date: string, done: boolean): Promise<HabitLog> {
    const logs = await read<HabitLog[]>(KEYS.habitLog, []);
    const existing = logs.find((l) => l.habitId === habitId && l.date === date);
    const entry: HabitLog = existing ? { ...existing, done } : { id: uid(), habitId, date, done };
    await write(KEYS.habitLog, existing ? logs.map((l) => (l === existing ? entry : l)) : [...logs, entry]);
    return entry;
  },

  async getTriggers(): Promise<Trigger[]> {
    await ensureSeeded();
    return read(KEYS.triggers, []);
  },
  async addTrigger(label: string): Promise<Trigger> {
    const triggers = await read<Trigger[]>(KEYS.triggers, []);
    const trigger: Trigger = { id: uid(), label, removed: false };
    await write(KEYS.triggers, [...triggers, trigger]);
    return trigger;
  },
  async toggleTrigger(triggerId: string, removed: boolean): Promise<{ ok: true }> {
    const triggers = await read<Trigger[]>(KEYS.triggers, []);
    await write(
      KEYS.triggers,
      triggers.map((t) => (t.id === triggerId ? { ...t, removed } : t)),
    );
    return { ok: true };
  },
  async updateTrigger(id: string, label: string): Promise<{ ok: true }> {
    const triggers = await read<Trigger[]>(KEYS.triggers, []);
    await write(
      KEYS.triggers,
      triggers.map((t) => (t.id === id ? { ...t, label } : t)),
    );
    return { ok: true };
  },
  async removeTrigger(id: string): Promise<{ ok: true }> {
    const triggers = await read<Trigger[]>(KEYS.triggers, []);
    await write(
      KEYS.triggers,
      triggers.filter((t) => t.id !== id),
    );
    return { ok: true };
  },

  async getEnergy(from: string, to: string): Promise<EnergyLog[]> {
    const logs = await read<EnergyLog[]>(KEYS.energy, []);
    return logs.filter((l) => inRange(l.date, from, to));
  },
  async setEnergy(date: string, hour: number, value: number): Promise<EnergyLog> {
    const logs = await read<EnergyLog[]>(KEYS.energy, []);
    const existing = logs.find((l) => l.date === date && l.hour === hour);
    const entry: EnergyLog = { date, hour, value };
    await write(KEYS.energy, existing ? logs.map((l) => (l === existing ? entry : l)) : [...logs, entry]);
    return entry;
  },

  async getSessions(from: string, to: string): Promise<FocusSession[]> {
    const sessions = await read<FocusSession[]>(KEYS.sessions, []);
    return sessions.filter((s) => inRange(s.date, from, to));
  },
  async addSession(date: string, durationMin: number): Promise<FocusSession> {
    const sessions = await read<FocusSession[]>(KEYS.sessions, []);
    const session: FocusSession = { id: uid(), date, durationMin, completedAt: new Date().toISOString() };
    await write(KEYS.sessions, [...sessions, session]);
    return session;
  },

  async getQuestion(from: string, to: string): Promise<DailyQuestion[]> {
    const questions = await read<DailyQuestion[]>(KEYS.question, []);
    return questions.filter((q) => inRange(q.date, from, to));
  },
  async setQuestion(date: string, text: string): Promise<DailyQuestion> {
    const questions = await read<DailyQuestion[]>(KEYS.question, []);
    const existing = questions.find((q) => q.date === date);
    const entry: DailyQuestion = { date, text };
    await write(KEYS.question, existing ? questions.map((q) => (q === existing ? entry : q)) : [...questions, entry]);
    return entry;
  },
};
