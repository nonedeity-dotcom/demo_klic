import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, DEFAULT_SCREEN_TIME_LIMIT_MIN } from "../api/client";
import { colors } from "../theme/colors";
import DataBackup from "../components/DataBackup";

/**
 * Everything that is a setting rather than a daily action, so the bottom bar
 * can go back to being six things you actually do. Reached from the gear in
 * the top-right of every screen.
 */

function Row({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

export default function SettingsScreen({ navigation }: { navigation: { navigate: (screen: string) => void } }) {
  const qc = useQueryClient();

  // The limit behind the "Экранное время в норме" habit was hardcoded at three
  // hours with nowhere to change it — the value existed in storage but no
  // screen ever wrote to it.
  const { data: limit = DEFAULT_SCREEN_TIME_LIMIT_MIN } = useQuery<number>({
    queryKey: ["screenTimeLimit"],
    queryFn: () => api.getScreenTimeLimitMinutes(),
  });

  const setLimit = useMutation({
    mutationFn: (minutes: number) => api.setScreenTimeLimitMinutes(minutes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["screenTimeLimit"] });
      // The habit is auto-ticked against this number, so today's verdict can
      // change the moment it moves.
      qc.invalidateQueries({ queryKey: ["habitLog"] });
    },
  });

  // 30 min ≤ limit ≤ 12 h: below half an hour the habit could never be met,
  // above twelve it stops meaning anything.
  const bump = (delta: number) => setLimit.mutate(Math.min(720, Math.max(30, limit + delta)));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.sectionLabel}>Справочник</Text>
      <Row
        label="Подсказки"
        hint="Всё, к чему подталкивает приложение, и почему"
        onPress={() => navigation.navigate("Library")}
      />

      <Text style={[styles.sectionLabel, styles.spaced]}>Напоминание</Text>
      <Row
        label="Ежедневное уведомление"
        hint="Время и включение"
        onPress={() => navigation.navigate("Reminder")}
      />

      <Text style={[styles.sectionLabel, styles.spaced]}>Экранное время</Text>
      <View style={styles.limitCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>Дневной лимит</Text>
          <Text style={styles.rowHint}>
            Привычка «Экранное время в норме» отмечается сама, если Creker насчитал меньше
          </Text>
        </View>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => bump(-30)}
            accessibilityRole="button"
            accessibilityLabel="Уменьшить лимит"
            style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
          >
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <Text style={styles.limitValue}>{formatMinutes(limit)}</Text>
          <Pressable
            onPress={() => bump(30)}
            accessibilityRole="button"
            accessibilityLabel="Увеличить лимит"
            style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.spaced}>
        <DataBackup />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
  spaced: { marginTop: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  pressed: { opacity: 0.75 },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: "500" },
  rowHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  limitCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 12,
  },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { color: colors.text, fontSize: 20, fontWeight: "600" },
  limitValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    minWidth: 90,
    textAlign: "center",
  },
});
