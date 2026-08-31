import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

// No server, so no conditional "only if habits aren't done yet" push — just
// a plain daily local reminder at a fixed time. Simpler and works with the
// app fully offline.

const SETTINGS_KEY = "reminder-setting-v1";
const NOTIFICATION_ID_KEY = "reminder-notification-id-v1";

export interface ReminderSettings {
  hour: number;
  minute: number;
  enabled: boolean;
}

const DEFAULT_SETTINGS: ReminderSettings = { hour: 21, minute: 0, enabled: false };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function getReminderSettings(): Promise<ReminderSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// Scheduling is cancel-then-reschedule, and the time picker fires one of these
// per tap on +/−. Run concurrently, two calls both read the same stored id,
// both cancel it, and both schedule a new one — leaving an orphan reminder
// nobody can cancel any more. Chaining keeps them strictly ordered.
let scheduleChain: Promise<unknown> = Promise.resolve();

/**
 * Persists the settings and re-arms the OS notification.
 *
 * Returns what was actually stored: if the user denies the notification
 * permission we cannot honour `enabled: true`, so it comes back as `false`.
 * Previously the requested value was written to storage before the permission
 * check and the early return left the toggle showing "on" with nothing
 * scheduled behind it.
 */
export async function setReminderSettings(settings: ReminderSettings): Promise<ReminderSettings> {
  const run = async (): Promise<ReminderSettings> => {
    const prevId = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
    if (prevId) {
      await Notifications.cancelScheduledNotificationAsync(prevId);
      await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
    }

    if (!settings.enabled) {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return settings;
    }

    const granted = await requestNotificationPermission();
    if (!granted) {
      const denied = { ...settings, enabled: false };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(denied));
      return denied;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Не сбивай ритм",
        body: "Загляни в чек-лист привычек — ещё есть время сегодня.",
      },
      trigger: {
        hour: settings.hour,
        minute: settings.minute,
        repeats: true,
      },
    });
    await AsyncStorage.setItem(NOTIFICATION_ID_KEY, id);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  };

  const next = scheduleChain.then(run, run);
  scheduleChain = next.catch(() => undefined);
  return next;
}

// Re-arms the OS-scheduled notification on app start (e.g. after the app
// was reinstalled/updated and the OS-level schedule was cleared).
export async function restoreReminder(): Promise<void> {
  const settings = await getReminderSettings();
  if (!settings.enabled) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  if (scheduled.length === 0) await setReminderSettings(settings);
}
