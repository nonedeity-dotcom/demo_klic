import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

export interface CrekerUsageDay {
  date: string;
  screenMillis: number;
  /**
   * Epoch millis up to which `screenMillis` is complete for that day — creker's
   * own contract calls this `updated_at`, and it is *not* the moment the row was
   * written. `0` means unknown (a creker build older than the column, or a day it
   * never finished measuring). Without this, a row that reads 0 ms is
   * indistinguishable from a day creker hasn't caught up on yet.
   */
  updatedAt: number;
}

interface CrekerUsageNativeModule {
  getScreenTime(fromDate: string, toDate: string): Promise<CrekerUsageDay[]>;
  getStatus(date: string): Promise<{
    installed: boolean;
    answered: boolean;
    denied: boolean;
    screenMillis?: number | null;
    updatedAt?: number | null;
  }>;
}

/**
 * Why there is no screen-time data, when there is none.
 *
 * getCrekerScreenTime flattens every failure into an empty list, which is right for the
 * habit tick — a missing creker is a normal state, not an error — but useless to someone
 * asking "is this working at all". These are the four answers worth telling apart:
 *
 * - not-installed: creker's provider isn't on this device
 * - refused: creker is here but won't answer us — the user hasn't allowed this app in
 *   creker's settings, or the permission isn't held
 * - silent: installed and not refusing, but the query failed anyway
 * - connected: it answered; `screenMillis` is null when it has no row for that day
 */
export type CrekerConnection =
  | { state: "not-installed" }
  | { state: "refused" }
  | { state: "silent" }
  | { state: "connected"; screenMillis: number | null; updatedAt: number | null };

// requireOptionalNativeModule (not requireNativeModule) — returns null instead of
// throwing when the module isn't linked (e.g. this file imported outside a native
// build), so callers don't need their own try/catch just to guard against that.
const native = Platform.OS === "android" ? requireOptionalNativeModule<CrekerUsageNativeModule>("CrekerUsage") : null;

/**
 * Screen time for [fromDate, toDate] ("yyyy-MM-dd", inclusive) from creker, a
 * separate screen-time tracker app on the same device — see modules/creker-usage's
 * native side and creker's own UsageProvider for how this actually reaches across
 * apps. Resolves to [] (never rejects) whenever creker isn't installed or has no
 * data for the range — that's the expected common case, not a failure.
 */
export async function getCrekerScreenTime(fromDate: string, toDate: string): Promise<CrekerUsageDay[]> {
  if (!native) return [];
  try {
    const rows = await native.getScreenTime(fromDate, toDate);
    // Older native side / older creker may omit updatedAt entirely; normalise it
    // here so every caller can treat the field as present and 0 as "unknown".
    return rows.map((row) => ({ ...row, updatedAt: Number(row.updatedAt) || 0 }));
  } catch {
    return [];
  }
}

/**
 * The same query as getCrekerScreenTime, asked for one day and reported honestly —
 * see [CrekerConnection]. Off Android there is nothing to ask, which reads the same as
 * creker not being installed.
 */
export async function getCrekerConnection(date: string): Promise<CrekerConnection> {
  if (!native) return { state: "not-installed" };
  try {
    const status = await native.getStatus(date);
    if (!status.installed) return { state: "not-installed" };
    if (status.denied) return { state: "refused" };
    if (!status.answered) return { state: "silent" };
    return {
      state: "connected",
      screenMillis: status.screenMillis == null ? null : Number(status.screenMillis),
      updatedAt: status.updatedAt == null ? null : Number(status.updatedAt),
    };
  } catch {
    // An older native side without getStatus at all lands here, and "installed but not
    // answering" is exactly what that is from the outside.
    return { state: "silent" };
  }
}
