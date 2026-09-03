import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PHASE_STEPS, phaseStepFor, type PhaseId } from "../lib/phase";

const ALERTS_KEY = "phase-alerts-v1";
const ANNOUNCED_KEY = "phase-announced-v1";

export interface PhaseAlert {
  enabled: boolean;
  title: string;
  body: string;
}

export type PhaseAlerts = Record<PhaseId, PhaseAlert>;

/**
 * What each stretch says when you reach it. Editable, because these are the only words the
 * app ever puts on your lock screen unprompted and they should sound like something you'd
 * say to yourself.
 *
 * The dip's text is the one that matters: the source's whole finding is that people quit
 * there because they read "this is hard now" as "this isn't for me".
 */
export const DEFAULT_PHASE_ALERTS: PhaseAlerts = {
  honeymoon: {
    enabled: true,
    title: "Начало положено",
    body: "Первый день в цепочке. Пока легко — это нормально и это ещё ничего не значит.",
  },
  dip: {
    enabled: true,
    title: "Начинается яма",
    body: "Дальше самая тяжёлая часть, здесь обычно и бросают. Если расхочется — это про фазу, а не про тебя.",
  },
  plateau: {
    enabled: true,
    title: "Худшее позади",
    body: "Три недели пройдены — дальше действие требует меньше усилий, чем требовало.",
  },
  autopilot: {
    enabled: true,
    title: "66 дней",
    body: "По этой схеме привычка закрепилась. Дальше её проще не ломать, чем поддерживать.",
  },
};

function normalizeAlerts(raw: unknown): PhaseAlerts {
  const stored = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const out = {} as PhaseAlerts;
  for (const step of PHASE_STEPS) {
    const fallback = DEFAULT_PHASE_ALERTS[step.id];
    const entry = stored[step.id];
    if (typeof entry !== "object" || entry === null) {
      out[step.id] = { ...fallback };
      continue;
    }
    const o = entry as Record<string, unknown>;
    out[step.id] = {
      enabled: o.enabled !== false,
      // An empty field would ship a blank notification, so clearing one restores the app's
      // own wording: "empty means default", not "empty means keep what was typed before".
      title: typeof o.title === "string" && o.title.trim() ? o.title : fallback.title,
      body: typeof o.body === "string" && o.body.trim() ? o.body : fallback.body,
    };
  }
  return out;
}

export async function getPhaseAlerts(): Promise<PhaseAlerts> {
  const raw = await AsyncStorage.getItem(ALERTS_KEY);
  if (!raw) return { ...DEFAULT_PHASE_ALERTS };
  try {
    return normalizeAlerts(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PHASE_ALERTS };
  }
}

export async function setPhaseAlert(id: PhaseId, patch: Partial<PhaseAlert>): Promise<PhaseAlerts> {
  const current = await getPhaseAlerts();
  const next: PhaseAlerts = { ...current, [id]: { ...current[id], ...patch } };
  await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(next));
  return normalizeAlerts(next);
}

/** Which stretches have already been announced during the current run of the streak. */
async function getAnnounced(): Promise<PhaseId[]> {
  const raw = await AsyncStorage.getItem(ANNOUNCED_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((v): v is PhaseId => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export type PhaseAnnounceResult = "sent" | "already-announced" | "disabled" | "no-streak" | "failed";

/**
 * Announces the stretch `streak` falls in, once per run of the streak.
 *
 * Called on app open rather than scheduled ahead: the streak only exists once the day's
 * habits are ticked, so there is no earlier moment at which the date of the next transition
 * is known. Which also means the notification lands while the app is in the foreground —
 * the handler in reminders.ts is set to show banners anyway, so it is seen rather than
 * silently swallowed.
 *
 * A broken chain clears the record, so the next run announces its stretches again.
 */
export async function announcePhase(streak: number): Promise<PhaseAnnounceResult> {
  const step = phaseStepFor(streak);
  if (!step) {
    // Streak is back to zero: forget what was announced so the next run starts clean.
    await AsyncStorage.removeItem(ANNOUNCED_KEY);
    return "no-streak";
  }

  const announced = await getAnnounced();
  if (announced.includes(step.id)) return "already-announced";

  const alerts = await getPhaseAlerts();
  const alert = alerts[step.id];
  // Recorded as announced even when switched off. Turning it back on mid-stretch should
  // not fire a notification about a stretch you are already halfway through.
  const remember = async () =>
    AsyncStorage.setItem(ANNOUNCED_KEY, JSON.stringify([...announced, step.id]));

  if (!alert.enabled) {
    await remember();
    return "disabled";
  }

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return "failed";

  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: alert.title, body: alert.body },
      trigger: { seconds: 2 },
    });
  } catch {
    return "failed";
  }
  await remember();
  return "sent";
}
