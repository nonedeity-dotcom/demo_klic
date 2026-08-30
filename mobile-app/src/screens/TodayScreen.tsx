import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import type { Habit, HabitLog } from "../types";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function TodayScreen() {
  const qc = useQueryClient();
  const today = todayKey();

  const { data: habits = [] } = useQuery<Habit[]>({
    queryKey: ["habits"],
    queryFn: () => api.getHabits() as Promise<Habit[]>,
  });

  const { data: logs = [] } = useQuery<HabitLog[]>({
    queryKey: ["habitLog", today],
    queryFn: () => api.getHabitLog(today, today) as Promise<HabitLog[]>,
  });

  const toggle = useMutation({
    mutationFn: ({ habitId, done }: { habitId: string; done: boolean }) =>
      api.toggleHabit(habitId, today, done),
    // Optimistic update so the checkbox feels instant instead of waiting
    // on a round trip — same snappy feel as the original local-storage demo.
    onMutate: async ({ habitId, done }) => {
      await qc.cancelQueries({ queryKey: ["habitLog", today] });
      const prev = qc.getQueryData<HabitLog[]>(["habitLog", today]) || [];
      const next = prev.some((l) => l.habitId === habitId)
        ? prev.map((l) => (l.habitId === habitId ? { ...l, done } : l))
        : [...prev, { id: "temp", habitId, date: today, done }];
      qc.setQueryData(["habitLog", today], next);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["habitLog", today], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["habitLog", today] }),
  });

  const doneCount = logs.filter((l) => l.done).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.subtle}>
        Сегодня выполнено {doneCount} из {habits.length}
      </Text>
      <View style={{ height: 16 }} />
      {habits.map((h) => {
        const checked = !!logs.find((l) => l.habitId === h.id)?.done;
        return (
          <Pressable
            key={h.id}
            onPress={() => toggle.mutate({ habitId: h.id, done: !checked })}
            style={[styles.card, checked && styles.cardChecked]}
          >
            <View style={[styles.checkbox, checked && styles.checkboxChecked]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{h.label}</Text>
              {!!h.hint && <Text style={styles.hint}>{h.hint}</Text>}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtle: { color: colors.textMuted, fontSize: 13 },
  card: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  cardChecked: { backgroundColor: "rgba(143,184,154,0.12)", borderColor: colors.accentGreenDark },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginTop: 2,
    borderWidth: 1.5,
    borderColor: "#4a5058",
  },
  checkboxChecked: { backgroundColor: colors.accentGreen, borderWidth: 0 },
  label: { color: colors.text, fontSize: 15, fontWeight: "500" },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
