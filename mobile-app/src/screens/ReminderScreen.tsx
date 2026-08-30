import { useEffect, useState } from "react";
import { View, Text, Pressable, Switch, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import { getReminderSettings, setReminderSettings, type ReminderSettings } from "../notifications/reminders";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function ReminderScreen() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);

  useEffect(() => {
    getReminderSettings().then(setSettings);
  }, []);

  if (!settings) return null;

  const update = (next: ReminderSettings) => {
    setSettings(next);
    setReminderSettings(next);
  };

  const bumpHour = (delta: number) => update({ ...settings, hour: (settings.hour + delta + 24) % 24 });
  const bumpMinute = (delta: number) => update({ ...settings, minute: (settings.minute + delta + 60) % 60 });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Напоминание</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 20 },
  title: { color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 4 },
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
});
