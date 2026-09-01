import { useEffect, useState } from "react";
import { View, Text, Pressable, Switch, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import { getReminderSettings, setReminderSettings, type ReminderSettings } from "../notifications/reminders";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function ReminderScreen() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    getReminderSettings().then(setSettings);
  }, []);

  if (!settings) return null;

  const update = (next: ReminderSettings) => {
    setSettings(next); // optimistic, so the controls stay responsive
    setReminderSettings(next).then((applied) => {
      // If the OS refused the permission, `enabled` comes back false — reflect
      // that instead of leaving a switch that claims reminders are on.
      setSettings(applied);
      setPermissionDenied(next.enabled && !applied.enabled);
    });
  };

  const bumpHour = (delta: number) => update({ ...settings, hour: (settings.hour + delta + 24) % 24 });
  const bumpMinute = (delta: number) => update({ ...settings, minute: (settings.minute + delta + 60) % 60 });

  return (
    <View style={styles.container}>
      {/* No title here any more: this is pushed from settings and the stack
          header already says "Напоминание". */}
      <Text style={styles.subtle}>Ежедневное уведомление в одно и то же время — заглянуть в чек-лист</Text>

      <View style={styles.timeRow}>
        <View style={styles.timeUnit}>
          <Pressable onPress={() => bumpHour(1)} style={styles.stepBtn}>
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
          <Text style={styles.timeValue}>{pad(settings.hour)}</Text>
          <Pressable onPress={() => bumpHour(-1)} style={styles.stepBtn}>
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
        </View>
        <Text style={styles.colon}>:</Text>
        <View style={styles.timeUnit}>
          <Pressable onPress={() => bumpMinute(5)} style={styles.stepBtn}>
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
          <Text style={styles.timeValue}>{pad(settings.minute)}</Text>
          <Pressable onPress={() => bumpMinute(-5)} style={styles.stepBtn}>
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.enableRow}>
        <Text style={styles.enableLabel}>Включено</Text>
        <Switch
          value={settings.enabled}
          onValueChange={(enabled) => update({ ...settings, enabled })}
          trackColor={{ false: colors.cardBorder, true: colors.accentGreenDark }}
          thumbColor={colors.text}
        />
      </View>

      {permissionDenied && (
        <Text style={styles.deniedNote}>
          Уведомления запрещены в настройках системы — напоминание не придёт. Разреши их для этого
          приложения и включи снова.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  subtle: { color: colors.textMuted, fontSize: 12, marginBottom: 32 },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  timeUnit: { alignItems: "center", gap: 10 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { color: colors.text, fontSize: 20, fontWeight: "600" },
  timeValue: { color: colors.text, fontSize: 36, fontWeight: "700", fontVariant: ["tabular-nums"] },
  colon: { color: colors.text, fontSize: 36, fontWeight: "700", marginBottom: 20 },
  enableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 40,
  },
  enableLabel: { color: colors.text, fontSize: 15, fontWeight: "500" },
  deniedNote: { color: colors.accent, fontSize: 12, lineHeight: 17, marginTop: 12 },
});
