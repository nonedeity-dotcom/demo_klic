import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

// No server, so no conditional "only if habits aren't done yet" push — just
// plain daily local reminders at fixed times. Simpler and works fully offline.

const SETTINGS_KEY = "reminder-setting-v1";
const NOTIFICATION_IDS_KEY = "reminder-notification-ids-v1";
/** Single-id key from when there was only ever one reminder a day. */
const LEGACY_ID_KEY = "reminder-notification-id-v1";

export interface ReminderTime {
  hour: number;
  minute: number;
  /**
   * What this one says. Optional: an empty slot uses DEFAULT_REMINDER_BODY, which is also
   * what every reminder said before they could be worded individually.
   */
  text?: string;
}

export const DEFAULT_REMINDER_TITLE = "Не сбивай ритм";
export const DEFAULT_REMINDER_BODY = "Загляни в чек-лист привычек — ещё есть время сегодня.";

export interface ReminderSettings {
  /** One entry per notification per day, in the order shown. */
  times: ReminderTime[];
  enabled: boolean;
}

/** Facts from the OS, so "does it work?" has an answer instead of a hope. */
export interface ReminderStatus {
  permission: "granted" | "denied" | "undetermined";
  /** False once Android stops offering the prompt — only system settings left. */
  canAskAgain: boolean;
  /** How many notifications the OS actually holds for this app right now. */
  scheduled: number;
}

export const MAX_REMINDERS_PER_DAY = 5;

/**
 * What actually happened when settings were applied.
 *
 * "It didn't work" has more than one cause, and they need different answers:
 * refuse the permission and the fix is in system settings; fail to schedule
 * and the fix isn't anywhere the user can reach. Reporting both as "запрещено
 * в настройках" — which a single boolean forced — sends people to a screen
 * where nothing is wrong.
 */
export type ReminderFailure = "permission" | "schedule";

export interface AppliedReminder {
  settings: ReminderSettings;
  failure: ReminderFailure | null;
  /** Platform error text, when there is one worth showing. */
  detail?: string;
}

const DEFAULT_SETTINGS: ReminderSettings = { times: [{ hour: 21, minute: 0 }], enabled: false };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function isTime(v: unknown): v is ReminderTime {
  if (typeof v !== "object" || v === null) return false;
  const { hour, minute } = v as Record<string, unknown>;
  return (
    typeof hour === "number" && typeof minute === "number" &&
    hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
  );
}

/** The slot's own wording, or the shared default when it has none. */
export function reminderBody(time: ReminderTime): string {
  return time.text?.trim() ? time.text.trim() : DEFAULT_REMINDER_BODY;
}

/** Accepts both the current shape and the single-time one that came before it. */
export function normalizeSettings(raw: unknown): ReminderSettings {
  if (typeof raw !== "object" || raw === null) return DEFAULT_SETTINGS;
  const o = raw as Record<string, unknown>;
  const enabled = o.enabled === true;

  const times = Array.isArray(o.times) ? o.times.filter(isTime) : [];
  if (times.length > 0) {
    return {
      enabled,
      times: times.slice(0, MAX_REMINDERS_PER_DAY).map((t) => ({
        hour: t.hour,
        minute: t.minute,
        ...(typeof t.text === "string" && t.text.trim() ? { text: t.text.trim() } : {}),
      })),
    };
  }
  // Legacy: { hour, minute, enabled }.
  if (isTime(o)) return { enabled, times: [{ hour: o.hour as number, minute: o.minute as number }] };
  return { ...DEFAULT_SETTINGS, enabled };
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * What the OS currently thinks, not what we asked for.
 *
 * `scheduled` is the number that actually answers "is this working" — a
 * switch set to on with nothing behind it is exactly the failure this is
 * here to expose.
 */
export async function getReminderStatus(): Promise<ReminderStatus> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    let scheduled = 0;
    try {
      scheduled = (await Notifications.getAllScheduledNotificationsAsync()).length;
    } catch {
      scheduled = 0;
    }
    return {
      permission: perm.status === "granted" ? "granted" : perm.status === "denied" ? "denied" : "undetermined",
      canAskAgain: perm.canAskAgain !== false,
      scheduled,
    };
  } catch {
    // Web, or a platform without the module: nothing is scheduled and nothing
    // can be asked for.
    return { permission: "denied", canAskAgain: false, scheduled: 0 };
  }
}

async function cancelStored(): Promise<void> {
  const raw = await AsyncStorage.getItem(NOTIFICATION_IDS_KEY);
  const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];
  const legacy = await AsyncStorage.getItem(LEGACY_ID_KEY);
  if (legacy) ids.push(legacy);
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Already gone (reinstall, OS cleanup) — nothing to undo.
    }
  }
  await AsyncStorage.removeItem(NOTIFICATION_IDS_KEY);
  await AsyncStorage.removeItem(LEGACY_ID_KEY);
}

// Scheduling is cancel-then-reschedule, and the pickers fire one of these per
// tap. Run concurrently, two calls both read the same stored ids, both cancel
// them, and both schedule new ones — leaving orphan reminders nobody can
// cancel any more. Chaining keeps them strictly ordered.
let scheduleChain: Promise<unknown> = Promise.resolve();

/**
 * Persists the settings and re-arms the OS notifications.
 *
 * Returns what was actually stored: if the permission is refused we cannot
 * honour `enabled: true`, so it comes back as `false` rather than leaving a
 * switch that claims reminders are on with nothing behind it.
 */
export async function setReminderSettings(settings: ReminderSettings): Promise<AppliedReminder> {
  const run = async (): Promise<AppliedReminder> => {
    const wanted = normalizeSettings(settings);
    await cancelStored();

    if (!wanted.enabled || wanted.times.length === 0) {
      const off = { ...wanted, enabled: false };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(off));
      return { settings: off, failure: null };
    }

    const granted = await requestNotificationPermission();
    if (!granted) {
      const denied = { ...wanted, enabled: false };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(denied));
      return { settings: denied, failure: "permission" };
    }

    const ids: string[] = [];
    let detail: string | undefined;
    for (const time of wanted.times) {
      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: DEFAULT_REMINDER_TITLE, body: reminderBody(time) },
          trigger: { hour: time.hour, minute: time.minute, repeats: true },
        });
        ids.push(id);
      } catch (e) {
        // One slot failing shouldn't cost the others, but keep the reason —
        // it is the only clue the user will ever get.
        detail = (e as Error)?.message;
      }
    }
    await AsyncStorage.setItem(NOTIFICATION_IDS_KEY, JSON.stringify(ids));
    // Nothing got through: report it as off rather than claiming success.
    const applied = { ...wanted, enabled: ids.length > 0 };
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(applied));
    return { settings: applied, failure: ids.length > 0 ? null : "schedule", detail };
  };

  const next = scheduleChain.then(run, run);
  scheduleChain = next.catch(() => undefined);
  return next;
}

/**
 * Fires one notification a few seconds from now, so "is it working" can be
 * answered by looking at the phone instead of waiting until 21:00.
 */
export async function sendTestNotification(): Promise<"sent" | "denied" | "failed"> {
  if (!(await requestNotificationPermission())) return "denied";
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: "Проверка", body: "Уведомления работают — так будет выглядеть напоминание." },
      trigger: { seconds: 5 },
    });
    return "sent";
  } catch {
    return "failed";
  }
}

// Re-arms the OS-scheduled notifications on app start (e.g. after the app was
// reinstalled/updated and the OS-level schedule was cleared).
export async function restoreReminder(): Promise<void> {
  const settings = await getReminderSettings();
  if (!settings.enabled) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (scheduled.length < settings.times.length) await setReminderSettings(settings);
  } catch {
    // Nothing to restore on a platform without the module.
  }
}
