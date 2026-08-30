import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

interface CrekerUsageNativeModule {
  getScreenTime(fromDate: string, toDate: string): Promise<{ date: string; screenMillis: number }[]>;
}

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
export async function getCrekerScreenTime(
  fromDate: string,
  toDate: string,
): Promise<{ date: string; screenMillis: number }[]> {
  if (!native) return [];
  try {
    return await native.getScreenTime(fromDate, toDate);
  } catch {
    return [];
  }
}
