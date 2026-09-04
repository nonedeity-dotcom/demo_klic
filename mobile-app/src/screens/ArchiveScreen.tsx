import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import { confirmDestructive } from "../lib/confirm";
import { dateNDaysAgo, formatDateShort } from "../lib/date";
import { plural } from "../lib/plural";
import { HABIT_WINDOW_DAYS, habitRun } from "../lib/habitStats";
import { useTodayKey } from "../lib/useTodayKey";
import type { Habit, HabitLog } from "../types";

/**
 * Habits that were put aside, with their history intact.
 *
 * The bin in the checklist used to be the only exit, and it erased the habit together with
 * every mark it ever had — so "I've stopped doing this one" cost you the proof that you
 * ever did it. This is where those now land: still readable, restorable in one tap, and
 * erasable only on purpose.
 */
export default function ArchiveScreen({
  navigation,
}: {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void };
}) {
  const qc = useQueryClient();
  const today = useTodayKey();
  const windowStart = dateNDaysAgo(HABIT_WINDOW_DAYS);

  const { data: archived = [] } = useQuery<Habit[]>({
    queryKey: ["archivedHabits"],
    queryFn: () => api.getArchivedHabits() as Promise<Habit[]>,
  });
  // Same cache entry the report and the per-habit screen use, so opening the archive does
  // not re-read four months of marks.
  const { data: logs = [] } = useQuery<HabitLog[]>({
    queryKey: ["habitLog", "streak", windowStart, today],
    queryFn: () => api.getHabitLog(windowStart, today) as Promise<HabitLog[]>,
  });

  // Both lists change: a restored habit reappears in the checklist, and an erased one takes
  // its marks with it, which every count of logs is reading.
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["habits"] });
    qc.invalidateQueries({ queryKey: ["archivedHabits"] });
    qc.invalidateQueries({ queryKey: ["habitLog"] });
  };

  const restore = useMutation({ mutationFn: (id: string) => api.restoreHabit(id), onSuccess: refresh });
  const erase = useMutation({ mutationFn: (id: string) => api.removeHabit(id), onSuccess: refresh });

  const confirmErase = (h: Habit) =>
    confirmDestructive(
      "Удалить навсегда?",
      `«${h.label}» и все её отметки исчезнут без возможности вернуть.`,
      () => erase.mutate(h.id),
    );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.intro}>
        Убранные привычки. Отметки сохранены — можно открыть отчёт по любой из них, вернуть
        в чек-лист или стереть насовсем. На зачёт дня они не влияют.
      </Text>

      {archived.length === 0 && (
        <View style={styles.empty}>
          <Feather name="archive" size={20} color={colors.textMuted} />
          <Text style={styles.emptyText}>
            Пока пусто. Привычка попадает сюда, когда убираешь её из чек-листа.
          </Text>
        </View>
      )}

      {archived.map((h) => {
        const run = habitRun(h, logs);
        return (
          <View key={h.id} style={styles.card}>
            <Pressable
              onPress={() => navigation.navigate("HabitReport", { habitId: h.id, title: h.label })}
              accessibilityRole="button"
              accessibilityLabel={`Отчёт: ${h.label}`}
              style={({ pressed }) => [styles.head, pressed && styles.pressed]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={2}>
                  {h.label}
                </Text>
                <Text style={styles.meta}>
                  {run.doneDays > 0
                    ? `${run.doneDays} ${plural(run.doneDays, ["день", "дня", "дней"])} отмечено · ` +
                      `${formatDateShort(run.firstDay!)} — ${formatDateShort(run.lastDay!)}`
                    : "ни разу не отмечалась"}
                </Text>
                {h.archivedAt && (
                  <Text style={styles.meta}>убрана {formatDateShort(h.archivedAt)}</Text>
                )}
              </View>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </Pressable>

            <View style={styles.actions}>
              <Pressable
                onPress={() => restore.mutate(h.id)}
                accessibilityRole="button"
                accessibilityLabel={`Вернуть в чек-лист: ${h.label}`}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <Feather name="corner-up-left" size={13} color={colors.accentGreen} />
                <Text style={[styles.actionText, { color: colors.accentGreen }]}>Вернуть</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmErase(h)}
                accessibilityRole="button"
                accessibilityLabel={`Удалить навсегда: ${h.label}`}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}
              >
                <Feather name="trash-2" size={13} color={colors.textMuted} />
                <Text style={styles.actionText}>Удалить навсегда</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  intro: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 18 },
  empty: { alignItems: "center", gap: 10, paddingVertical: 40 },
  emptyText: { color: colors.textMuted, fontSize: 12, textAlign: "center", maxWidth: 240, lineHeight: 17 },
  card: { backgroundColor: colors.card, borderRadius: 16, marginBottom: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  pressed: { opacity: 0.65 },
  name: { color: colors.text, fontSize: 14 },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  actions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
  },
  actionText: { color: colors.textMuted, fontSize: 12 },
});
