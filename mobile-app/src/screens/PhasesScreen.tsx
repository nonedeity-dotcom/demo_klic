import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import { dateNDaysAgo } from "../lib/date";
import { useTodayKey } from "../lib/useTodayKey";
import { plural } from "../lib/plural";
import { computeStreak, STREAK_WINDOW_DAYS } from "../lib/streak";
import { AUTOPILOT_DAY, PHASE_STEPS, phaseStepFor } from "../lib/phase";
import type { Habit, HabitLog } from "../types";

/**
 * What the four stretches are, with the one you're in marked.
 *
 * The report used to carry the current stretch's paragraph inline, above the bar. It said
 * the right thing but only ever about today, and it said it every single day — so it moved
 * here, where all four sit next to each other and the bar on the report points at it.
 */
export default function PhasesScreen() {
  const today = useTodayKey();
  const streak = useStreak(today);
  const current = phaseStepFor(streak);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.intro}>
        Границы приблизительные: в источнике названы сами этапы и то, что первые две недели самые
        трудные, а 66 дней — ориентир, после которого привычка держится сама. Точных дат он не даёт.
      </Text>

      {PHASE_STEPS.map((step) => {
        const active = current?.id === step.id;
        return (
          <View key={step.id} style={[styles.card, active && styles.cardActive]}>
            <View style={styles.headRow}>
              <Text style={[styles.title, active && styles.titleActive]}>{step.title}</Text>
              {active && <Text style={styles.badge}>ты здесь</Text>}
            </View>
            <Text style={styles.range}>{step.range}</Text>
            <Text style={styles.body}>{step.body}</Text>
          </View>
        );
      })}

      <Text style={styles.footer}>
        {streak > 0
          ? `Сейчас ${streak} ${plural(streak, ["день", "дня", "дней"])} подряд — до ${AUTOPILOT_DAY} осталось ${
              Math.max(0, AUTOPILOT_DAY - streak)
            } ${plural(Math.max(0, AUTOPILOT_DAY - streak), ["день", "дня", "дней"])}.`
          : "Серии пока нет — этапы начнутся с первого отмеченного дня."}
      </Text>
    </ScrollView>
  );
}

/**
 * The same count the report shows, from the same function — a number passed in as a route
 * param would freeze at navigation time and go stale the moment a habit is ticked, and the
 * queries it reads from are already cached by the report.
 */
function useStreak(today: string): number {
  const windowStart = dateNDaysAgo(STREAK_WINDOW_DAYS);
  const { data: habits = [] } = useQuery<Habit[]>({
    queryKey: ["habits"],
    queryFn: () => api.getHabits() as Promise<Habit[]>,
  });
  const { data: logs = [] } = useQuery<HabitLog[]>({
    queryKey: ["habitLog", "streak", windowStart, today],
    queryFn: () => api.getHabitLog(windowStart, today) as Promise<HabitLog[]>,
  });
  return computeStreak(habits, logs);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  intro: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  cardActive: { borderColor: colors.accentGreen, backgroundColor: "rgba(143,184,154,0.12)" },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  titleActive: { color: colors.accentGreen },
  badge: { color: colors.accentGreen, fontSize: 11 },
  range: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  body: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  footer: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 8 },
});
