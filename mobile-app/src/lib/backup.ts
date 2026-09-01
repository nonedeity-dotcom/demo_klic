import {
  BACKUP_FORMAT_VERSION,
  exportData,
  mergeData,
  replaceData,
  type BackupData,
  type ImportStats,
} from "../api/client";
import { getReminderSettings, setReminderSettings, type ReminderSettings } from "../notifications/reminders";
import { toDateKey } from "./date";
import type { Habit, HabitLog, Trigger, EnergyLog, FocusSession, DailyQuestion, RewardOption, Reward } from "../types";

/** Marks the file as ours, so a random .json picked by mistake is rejected. */
const APP_ID = "no-burnout";

export interface BackupFile {
  app: typeof APP_ID;
  formatVersion: number;
  exportedAt: string;
  data: BackupData;
  reminder: ReminderSettings;
}

export type ImportMode = "merge" | "replace";

/** A problem with the file itself; `message` is shown to the user as-is. */
export class BackupError extends Error {}

export function backupFileName(now = new Date()): string {
  return `no-burnout-${toDateKey(now)}.json`;
}

/** The exact text that gets written to the file. */
export async function buildBackupText(): Promise<string> {
  const [data, reminder] = await Promise.all([exportData(), getReminderSettings()]);
  const file: BackupFile = {
    app: APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    reminder,
  };
  // Indented: the file is small and a person may well open it in a text editor.
  return JSON.stringify(file, null, 2);
}

// --- validation -------------------------------------------------------------
//
// The file comes from the user's storage, so it can be anything: another app's
// export, a truncated download, a hand-edited copy. Every field is checked
// before a single byte is written, and a bad entry is dropped rather than
// allowed to blow up a screen later.

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isDateKey = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickValid<T>(value: unknown, keep: (row: Record<string, unknown>, index: number) => T | null): T[] {
  const out: T[] = [];
  list(value).forEach((row, index) => {
    if (!isObj(row)) return;
    const parsed = keep(row, index);
    if (parsed) out.push(parsed);
  });
  return out;
}

function parseData(raw: unknown): BackupData {
  const d = isObj(raw) ? raw : {};

  const habits = pickValid<Habit>(d.habits, (h, index) =>
    isStr(h.id) && isStr(h.label)
      ? {
          id: h.id,
          label: h.label,
          hint: isStr(h.hint) ? h.hint : null,
          sortOrder: isNum(h.sortOrder) ? h.sortOrder : index,
          auto: h.auto === "screentime" ? "screentime" : null,
        }
      : null,
  );

  const habitLog = pickValid<HabitLog>(d.habitLog, (l) =>
    isStr(l.habitId) && isDateKey(l.date)
      ? { id: isStr(l.id) ? l.id : `${l.habitId}-${l.date}`, habitId: l.habitId, date: l.date, done: l.done === true }
      : null,
  );

  const triggers = pickValid<Trigger>(d.triggers, (t) =>
    isStr(t.id) && isStr(t.label) ? { id: t.id, label: t.label, removed: t.removed === true } : null,
  );

  const energy = pickValid<EnergyLog>(d.energy, (e) =>
    isDateKey(e.date) && isNum(e.hour) && isNum(e.value)
      ? { date: e.date, hour: Math.trunc(e.hour), value: Math.trunc(e.value) }
      : null,
  );

  const sessions = pickValid<FocusSession>(d.sessions, (s) =>
    isStr(s.id) && isDateKey(s.date) && isNum(s.durationMin)
      ? {
          id: s.id,
          date: s.date,
          durationMin: s.durationMin,
          completedAt: isStr(s.completedAt) ? s.completedAt : `${s.date}T00:00:00.000Z`,
        }
      : null,
  );

  const question = pickValid<DailyQuestion>(d.question, (q) =>
    isDateKey(q.date) && isStr(q.text) ? { date: q.date, text: q.text } : null,
  );

  const rewardOptions = pickValid<RewardOption>(d.rewardOptions, (o) =>
    isStr(o.id) && isStr(o.label) ? { id: o.id, label: o.label } : null,
  );

  const rewards = pickValid<Reward>(d.rewards, (r) =>
    isStr(r.id) && isDateKey(r.date) && isStr(r.text) ? { id: r.id, date: r.date, text: r.text } : null,
  );

  const milestones = list(d.milestones).filter(isNum);

  const limit = isNum(d.screenTimeLimitMinutes) && d.screenTimeLimitMinutes > 0 ? d.screenTimeLimitMinutes : 180;

  return { habits, habitLog, triggers, energy, sessions, question, milestones, rewardOptions, rewards, screenTimeLimitMinutes: limit };
}

function parseReminder(raw: unknown): ReminderSettings | null {
  if (!isObj(raw)) return null;
  const { hour, minute, enabled } = raw;
  if (!isNum(hour) || !isNum(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour: Math.trunc(hour), minute: Math.trunc(minute), enabled: enabled === true };
}

export interface ParsedBackup {
  data: BackupData;
  reminder: ReminderSettings | null;
  exportedAt: string | null;
}

/** Turns file text into something safe to write. Throws `BackupError`. */
export function parseBackupText(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("Это не файл резервной копии — не удалось прочитать JSON.");
  }
  if (!isObj(raw)) throw new BackupError("Это не файл резервной копии.");
  if (raw.app !== APP_ID) throw new BackupError("Файл не от этого приложения — ищи no-burnout-….json.");
  if (isNum(raw.formatVersion) && raw.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupError("Файл создан более новой версией приложения — обнови приложение и попробуй снова.");
  }

  const data = parseData(raw.data);
  const isEmpty =
    data.habits.length === 0 &&
    data.habitLog.length === 0 &&
    data.triggers.length === 0 &&
    data.sessions.length === 0 &&
    data.energy.length === 0 &&
    data.question.length === 0 &&
    data.rewards.length === 0;
  if (isEmpty) throw new BackupError("В файле нет данных, которые можно перенести.");

  return { data, reminder: parseReminder(raw.reminder), exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : null };
}

/**
 * Writes a parsed backup to the device.
 *
 * The reminder time is only taken on a full replace — merging is for pulling
 * history in from another phone, and silently re-arming someone else's 21:00
 * notification would be a surprise.
 */
export async function applyBackup(parsed: ParsedBackup, mode: ImportMode): Promise<ImportStats> {
  const stats = mode === "replace" ? await replaceData(parsed.data) : await mergeData(parsed.data);
  if (mode === "replace" && parsed.reminder) {
    // Goes through setReminderSettings, not straight to storage, so the OS
    // notification is actually re-scheduled for the restored time.
    await setReminderSettings(parsed.reminder);
  }
  return stats;
}
