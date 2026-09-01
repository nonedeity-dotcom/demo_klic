import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, AppState, Linking, Platform, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import {
  getReminderStatus,
  requestNotificationPermission,
  sendTestNotification,
  type ReminderStatus,
} from "../notifications/reminders";

/**
 * Whether notifications actually work, in plain words.
 *
 * The reminder switch alone could never answer that: it says what was asked
 * for, not what the OS did with it. This reads the permission back from the
 * system, shows how many notifications the OS is really holding, and can fire
 * a test one so the answer doesn't have to wait until 21:00.
 */
export default function NotificationAccess({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    getReminderStatus().then(setStatus);
  }, []);

  useEffect(() => {
    refresh();
    // Coming back from the system settings screen is exactly when the answer
    // changes, and nothing else would tell us.
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (!status) return null;

  const granted = status.permission === "granted";
  const permanentlyDenied = status.permission === "denied" && !status.canAskAgain;

  const ask = async () => {
    setBusy(true);
    setTestResult(null);
    await requestNotificationPermission();
    refresh();
    onChanged?.();
    setBusy(false);
  };

  const openSystemSettings = () => {
    // openSettings exists on both platforms; on web it throws, hence the catch.
    Linking.openSettings?.().catch(() => setTestResult("Не удалось открыть настройки системы — открой их вручную."));
  };

  const test = async () => {
    setBusy(true);
    const result = await sendTestNotification();
    setTestResult(
      result === "sent"
        ? "Отправлено — уведомление придёт через несколько секунд."
        : result === "denied"
          ? "Нет доступа: система не пропустила уведомление."
          : "Не получилось отправить — похоже, уведомления недоступны на этом устройстве.",
    );
    refresh();
    setBusy(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.statusRow}>
        <Feather
          name={granted ? "check-circle" : "alert-circle"}
          size={18}
          color={granted ? colors.accentGreen : colors.accent}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusText, { color: granted ? colors.accentGreen : colors.accent }]}>
            {granted
              ? "Доступ к уведомлениям есть"
              : permanentlyDenied
                ? "Доступа нет — запретили в системе"
                : status.permission === "denied"
                  ? "Доступа нет"
                  : "Доступ ещё не запрашивали"}
          </Text>
          <Text style={styles.statusHint}>
            {granted
              ? `Система держит ${status.scheduled} ${
                  status.scheduled === 1 ? "запланированное уведомление" : "запланированных уведомлений"
                }`
              : "Пока доступа нет, напоминания не придут, даже если тумблер включён"}
          </Text>
        </View>
      </View>

      {!granted && !permanentlyDenied && (
        <Pressable
          onPress={ask}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.primaryBtnText}>Дать доступ к уведомлениям</Text>
        </Pressable>
      )}

      {permanentlyDenied && (
        <>
          <Text style={styles.deniedNote}>
            Система больше не показывает запрос — разрешение включается только в её настройках.
          </Text>
          {Platform.OS !== "web" && (
            <Pressable
              onPress={openSystemSettings}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.primaryBtnText}>Открыть настройки системы</Text>
            </Pressable>
          )}
        </>
      )}

      <Pressable
        onPress={test}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryBtnText}>Отправить тестовое уведомление</Text>
      </Pressable>

      {testResult && <Text style={styles.testResult}>{testResult}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  statusRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  statusText: { fontSize: 14, fontWeight: "600" },
  statusHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  primaryBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  primaryBtnText: { color: colors.bg, fontSize: 13, fontWeight: "600" },
  secondaryBtn: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  secondaryBtnText: { color: colors.text, fontSize: 13, fontWeight: "500" },
  pressed: { opacity: 0.7 },
  deniedNote: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  testResult: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
});
