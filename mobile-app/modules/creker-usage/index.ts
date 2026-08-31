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
  // TEMPORARY diagnostic logging for the E2E investigation (checkbox not
  // auto-ticking despite creker having seeded data) — pins down whether the
  // native module linked at all vs. resolved with an empty/erroring result,
  // instead of guessing from ambiguous native-side ActivityThread log lines.
  console.log("[CrekerUsage] native module resolved:", !!native);
  if (!native) return [];
  try {
    const result = await native.getScreenTime(fromDate, toDate);
    console.log("[CrekerUsage] getScreenTime result:", JSON.stringify(result));
    return result;
  } catch (e) {
    console.log("[CrekerUsage] getScreenTime threw:", String(e));
    return [];
  }
}
