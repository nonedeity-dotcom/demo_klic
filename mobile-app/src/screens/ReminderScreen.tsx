import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Switch, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import NotificationAccess from "../components/NotificationAccess";
import {
  getReminderSettings,
  setReminderSettings,
  MAX_REMINDERS_PER_DAY,
  type ReminderFailure,
  type ReminderSettings,
  type ReminderTime,
} from "../notifications/reminders";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Spreads a new slot away from the last one rather than stacking a second
 * reminder on the same minute, which is what a plain copy would do.
 */
function nextSlot(times: ReminderTime[]): ReminderTime {
  const last = times[times.length - 1] ?? { hour: 21, minute: 0 };
  return { hour: (last.hour + 3) % 24, minute: last.minute };
}

export default function ReminderScreen() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [failure, setFailure] = useState<{ kind: ReminderFailure; detail?: string } | null>(null);
  const [statusKey, setStatusKey] = useState(0);

  useEffect(() => {
    getReminderSettings().then(setSettings);
  }, []);

  const update = useCallback((next: ReminderSettings) => {
    setSettings(next); // optimistic, so the controls stay responsive
    setReminderSettings(next).then((applied) => {
      // If the OS refused, `enabled` comes back false — reflect that instead
      // of leaving a switch that claims reminders are on with nothing behind it.
      setSettings(applied.settings);
      setFailure(applied.failure ? { kind: applied.failure, detail: applied.detail } : null);
      // The scheduled count in the status block just changed.
      setStatusKey((k) => k + 1);
    });
  }, []);

  if (!settings) return null;

  const patchTime = (index: number, patch: Partial<ReminderTime>) =>
    update({
      ...settings,
      times: settings.times.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    });

  const bumpHour = (i: number, delta: number) =>
    patchTime(i, { hour: (settings.times[i].hour + delta + 24) % 24 });
  const bumpMinute = (i: number, delta: number) =>
    patchTime(i, { minute: (settings.times[i].minute + delta + 60) % 60 });

  const setCount = (count: number) => {
    const target = Math.min(MAX_REMINDERS_PER_DAY, Math.max(1, count));
    const times = [...settings.times];
    while (times.length > target) times.pop();
    while (times.length < target) times.push(nextSlot(times));
    update({ ...settings, times });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.subtle}>
        Ежедневные уведомления в одно и то же время — заглянуть в чек-лист
      </Text>

      {/* Above the settings on purpose: a time picker is pointless if the OS
          isn't letting anything through, and that is the first thing to know. */}
      <NotificationAccess key={statusKey} onChanged={() => setStatusKey((k) => k + 1)} />

      <View style={styles.enableRow}>
        <Text style={styles.enableLabel}>Включено</Text>
        <Switch
          value={settings.enabled}
          onValueChange={(enabled) => update({ ...settings, enabled })}
          accessibilityLabel="Включить напоминания"
          trackColor={{ false: colors.cardBorder, true: colors.accentGreenDark }}
          thumbColor={colors.text}
        />
      </View>

      {failure && (
        <Text style={styles.deniedNote}>
          {failure.kind === "permission"
            ? "Уведомления запрещены в настройках системы — напоминание не придёт. Разреши их выше и включи снова."
            : `Не удалось поставить напоминание в расписание — на этом устройстве оно не сработает.${
                failure.detail ? ` Система ответила: ${failure.detail}` : ""
              }`}
        </Text>
      )}

      <View style={styles.countRow}>
        <Text style={styles.enableLabel}>Сколько раз в день</Text>
        <View style={styles.counter}>
          <Pressable
            onPress={() => setCount(settings.times.length - 1)}
            disabled={settings.times.length <= 1}
            accessibilityRole="button"
            accessibilityLabel="Меньше уведомлений в день"
            style={({ pressed }) => [
              styles.smallBtn,
              (pressed || settings.times.length <= 1) && styles.dimmed,
            ]}
          >
            <Text style={styles.smallBtnText}>−</Text>
          </Pressable>
          <Text style={styles.countValue}>{settings.times.length}</Text>
          <Pressable
            onPress={() => setCount(settings.times.length + 1)}
            disabled={settings.times.length >= MAX_REMINDERS_PER_DAY}
            accessibilityRole="button"
            accessibilityLabel="Больше уведомлений в день"
            style={({ pressed }) => [
              styles.smallBtn,
              (pressed || settings.times.length >= MAX_REMINDERS_PER_DAY) && styles.dimmed,
            ]}
          >
            <Text style={styles.smallBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Every slot gets its own picker: spreading N reminders across the day
          automatically would mean guessing when your day starts. */}
      {settings.times.map((time, i) => (
        <View key={i} style={styles.timeCard}>
          <View style={styles.timeHeader}>
            <Feather name="bell" size={14} color={colors.textMuted} />
            <Text style={styles.timeIndex}>Напоминание {i + 1}</Text>
          </View>
          <View style={styles.timeRow}>
            <View style={styles.timeUnit}>
              <Pressable
                onPress={() => bumpHour(i, 1)}
                accessibilityRole="button"
                accessibilityLabel={`Напоминание ${i + 1}: час +1`}
                style={({ pressed }) => [styles.stepBtn, pressed && styles.dimmed]}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
              <Text style={styles.timeValue}>{pad(time.hour)}</Text>
              <Pressable
                onPress={() => bumpHour(i, -1)}
                accessibilityRole="button"
                accessibilityLabel={`Напоминание ${i + 1}: час −1`}
                style={({ pressed }) => [styles.stepBtn, pressed && styles.dimmed]}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
            </View>
            <Text style={styles.colon}>:</Text>
            <View style={styles.timeUnit}>
              <Pressable
                onPress={() => bumpMinute(i, 5)}
                accessibilityRole="button"
                accessibilityLabel={`Напоминание ${i + 1}: минуты +5`}
                style={({ pressed }) => [styles.stepBtn, pressed && styles.dimmed]}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
              <Text style={styles.timeValue}>{pad(time.minute)}</Text>
              <Pressable
                onPress={() => bumpMinute(i, -5)}
                accessibilityRole="button"
                accessibilityLabel={`Напоминание ${i + 1}: минуты −5`}
                style={({ pressed }) => [styles.stepBtn, pressed && styles.dimmed]}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtle: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 16 },
  enableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,
  },
  enableLabel: { color: colors.text, fontSize: 15, fontWeight: "500" },
  deniedNote: { color: colors.accent, fontSize: 12, lineHeight: 17, marginTop: 10 },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  counter: { flexDirection: "row", alignItems: "center", gap: 14 },
  smallBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnText: { color: colors.text, fontSize: 18, fontWeight: "600" },
  countValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    minWidth: 18,
    textAlign: "center",
  },
  dimmed: { opacity: 0.5 },
  timeCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  timeHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeIndex: { color: colors.textMuted, fontSize: 12 },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 },
  timeUnit: { alignItems: "center", gap: 8 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { color: colors.text, fontSize: 18, fontWeight: "600" },
  timeValue: { color: colors.text, fontSize: 30, fontWeight: "700", fontVariant: ["tabular-nums"] },
  colon: { color: colors.text, fontSize: 30, fontWeight: "700", marginBottom: 16 },
});
