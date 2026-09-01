import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import { dateNDaysAgo } from "../lib/date";
import { useTodayKey } from "../lib/useTodayKey";
import { confirmDestructive } from "../lib/confirm";
import type { EnergyLog, Task } from "../types";

const WAKE_HOUR = 7;
const SLEEP_HOUR = 23;
const HOURS = Array.from({ length: SLEEP_HOUR - WAKE_HOUR + 1 }, (_, i) => WAKE_HOUR + i);
// A peak worth planning around needs more than one day of marks.
const HISTORY_DAYS = 7;
const MIN_DAYS_FOR_HINT = 3;

export default function EnergyScreen() {
  const qc = useQueryClient();
  const today = useTodayKey();
  const from = dateNDaysAgo(HISTORY_DAYS - 1);

  const { data: todayLogs = [] } = useQuery<EnergyLog[]>({
    queryKey: ["energy", today],
    queryFn: () => api.getEnergy(today, today) as Promise<EnergyLog[]>,
  });

  // The hint promised "отмечай 3-5 дней подряд", but the screen only ever
  // read today — so it was calling a peak off a single day's marks.
  const { data: historyLogs = [] } = useQuery<EnergyLog[]>({
    queryKey: ["energy", "history", from, today],
    queryFn: () => api.getEnergy(from, today) as Promise<EnergyLog[]>,
  });

  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["tasks"], queryFn: () => api.getTasks() });
  const invalidateTasks = () => qc.invalidateQueries({ queryKey: ["tasks"] });
  const [taskDraft, setTaskDraft] = useState("");
  const [taskKind, setTaskKind] = useState<Task["kind"]>("hard");

  const addTask = useMutation({
    mutationFn: () => api.addTask(taskDraft.trim(), taskKind),
    onSuccess: () => {
      setTaskDraft("");
      invalidateTasks();
    },
  });
  const setTaskDone = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => api.setTaskDone(id, done),
    onSuccess: invalidateTasks,
  });
  const removeTask = useMutation({ mutationFn: (id: string) => api.removeTask(id), onSuccess: invalidateTasks });
  const clearDone = useMutation({ mutationFn: () => api.clearDoneTasks(), onSuccess: invalidateTasks });

  const setEnergy = useMutation({
    mutationFn: ({ hour, value }: { hour: number; value: number }) => api.setEnergy(today, hour, value),
    onSettled: () => qc.invalidateQueries({ queryKey: ["energy"] }),
  });

  const valueFor = (hour: number) => todayLogs.find((l) => l.hour === hour)?.value || 0;

  // Average each hour across the whole window, then read the peak/dip off that.
  const marked = historyLogs.filter((l) => l.value > 0);
  const daysMarked = new Set(marked.map((l) => l.date)).size;
  const byHour = new Map<number, { sum: number; n: number }>();
  for (const l of marked) {
    const acc = byHour.get(l.hour) ?? { sum: 0, n: 0 };
    byHour.set(l.hour, { sum: acc.sum + l.value, n: acc.n + 1 });
  }
  const averages = [...byHour.entries()].map(([hour, { sum, n }]) => ({ hour, avg: sum / n }));
  const peakHour = averages.length ? averages.reduce((a, b) => (b.avg > a.avg ? b : a)).hour : null;
  const dipHour = averages.length ? averages.reduce((a, b) => (b.avg < a.avg ? b : a)).hour : null;
  const hasEnoughData = daysMarked >= MIN_DAYS_FOR_HINT && averages.length >= 2;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.subtle}>Отметь уровень энергии по часам</Text>
      <Text style={[styles.subtle, { marginBottom: 20 }]}>
        так видно пики (сложные задачи) и спады (рутина)
      </Text>

      <View style={styles.hintCard}>
        {hasEnoughData ? (
          <>
            <Text style={styles.hintText}>
              <Text style={{ color: colors.accentGreen, fontWeight: "700" }}>Пик в {peakHour}:00</Text> — ставь сюда
              сложные аналитические задачи.
            </Text>
            <Text style={[styles.hintText, { marginTop: 4 }]}>
              <Text style={{ color: colors.accent, fontWeight: "700" }}>Спад в {dipHour}:00</Text> — подходит для
              рутины.
            </Text>
            <Text style={styles.hintFootnote}>по отметкам за {daysMarked} дн. из последних {HISTORY_DAYS}</Text>
          </>
        ) : (
          <Text style={styles.hintText}>
            Отмечай энергию хотя бы {MIN_DAYS_FOR_HINT} дня — тогда здесь появятся твои реальные пики и спады.
            {daysMarked > 0 ? ` Пока отмечено дней: ${daysMarked}.` : ""}
          </Text>
        )}
      </View>

      <View style={styles.grid}>
        {HOURS.map((h) => {
          const v = valueFor(h);
          return (
            <View key={h} style={styles.hourBlock}>
              <Text style={styles.hourLabel}>{h}:00</Text>
              <View style={styles.presetRow}>
                {[3, 6, 9].map((preset) => (
                  <Pressable
                    key={preset}
                    onPress={() => setEnergy.mutate({ hour: h, value: v === preset ? 0 : preset })}
                    style={[styles.presetDot, v === preset && styles.presetDotActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: v === preset }}
                    accessibilityLabel={`${h}:00 — энергия ${preset}`}
                  >
                    {/* Muted grey on the green active fill was barely legible. */}
                    <Text style={[styles.presetText, v === preset && styles.presetTextActive]}>{preset}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {/* The measurement was going nowhere: the screen found your peak and dip
          and then left you to remember them. This is the half the source
          actually asks for — hard work on the peaks, routine in the dips. */}
      <Text style={styles.tasksLabel}>Задачи</Text>
      <Text style={styles.tasksHint}>
        {hasEnoughData
          ? `Тяжёлое — ближе к ${peakHour}:00, рутину — к ${dipHour}:00.`
          : "Пики появятся, когда наберётся достаточно отметок — пока просто список."}
      </Text>

      <View style={styles.taskAddRow}>
        <TextInput
          value={taskDraft}
          onChangeText={setTaskDraft}
          placeholder="Что сделать…"
          placeholderTextColor={colors.textMuted}
          style={styles.taskInput}
          accessibilityLabel="Новая задача"
          onSubmitEditing={() => taskDraft.trim() && addTask.mutate()}
        />
        <Pressable
          onPress={() => taskDraft.trim() && addTask.mutate()}
          accessibilityRole="button"
          accessibilityLabel="Добавить задачу"
          style={({ pressed }) => [styles.taskAddBtn, pressed && styles.dimmed]}
        >
          <Feather name="plus" size={16} color={colors.accentGreen} />
        </Pressable>
      </View>

      <View style={styles.kindRow}>
        {([
          ["hard", "Тяжёлая"],
          ["routine", "Рутина"],
        ] as const).map(([kind, label]) => (
          <Pressable
            key={kind}
            onPress={() => setTaskKind(kind)}
            accessibilityRole="button"
            accessibilityState={{ selected: taskKind === kind }}
            style={({ pressed }) => [styles.kindChip, taskKind === kind && styles.kindChipOn, pressed && styles.dimmed]}
          >
            <Text style={[styles.kindText, taskKind === kind && styles.kindTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tasks.map((t) => {
        const suggested = t.kind === "hard" ? peakHour : dipHour;
        return (
          <View key={t.id} style={[styles.taskCard, t.done && styles.taskCardDone]}>
            <Pressable
              onPress={() => setTaskDone.mutate({ id: t.id, done: !t.done })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: t.done }}
              accessibilityLabel={t.label}
              style={styles.taskMain}
            >
              <View style={[styles.taskBox, t.done && styles.taskBoxDone]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.taskLabel, t.done && styles.taskLabelDone]}>{t.label}</Text>
                <Text style={styles.taskMeta}>
                  {t.kind === "hard" ? "тяжёлая" : "рутина"}
                  {hasEnoughData && suggested !== null && !t.done ? ` · лучше к ${suggested}:00` : ""}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() =>
                confirmDestructive("Удалить задачу?", `«${t.label}» будет удалена.`, () => removeTask.mutate(t.id))
              }
              accessibilityLabel={`Удалить задачу: ${t.label}`}
              style={styles.iconBtn}
            >
              <Feather name="trash-2" size={13} color={colors.textMuted} />
            </Pressable>
          </View>
        );
      })}

      {tasks.some((t) => t.done) && (
        <Pressable
          onPress={() => clearDone.mutate()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.clearDone, pressed && styles.dimmed]}
        >
          <Text style={styles.clearDoneText}>Убрать выполненные</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtle: { color: colors.textMuted, fontSize: 13 },
  hintCard: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 20 },
  hintText: { color: colors.text, fontSize: 12, lineHeight: 17 },
  hintFootnote: { color: colors.textMuted, fontSize: 10, marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  hourBlock: { width: "22%", alignItems: "center", gap: 6 },
  hourLabel: { color: colors.textMuted, fontSize: 10 },
  presetRow: { flexDirection: "row", gap: 4 },
  presetDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  presetDotActive: { backgroundColor: colors.accentGreen },
  presetText: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },
  presetTextActive: { color: colors.bg },
  dimmed: { opacity: 0.65 },
  tasksLabel: { color: colors.text, fontSize: 15, fontWeight: "600", marginTop: 28 },
  tasksHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4, marginBottom: 12 },
  taskAddRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  taskInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  taskAddBtn: { padding: 8 },
  kindRow: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 12 },
  kindChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  kindChipOn: { backgroundColor: "rgba(143,184,154,0.12)", borderColor: colors.accentGreen },
  kindText: { color: colors.textMuted, fontSize: 12 },
  kindTextOn: { color: colors.accentGreen, fontWeight: "600" },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  taskCardDone: { opacity: 0.55 },
  taskMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  taskBox: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: "#4a5058" },
  taskBoxDone: { backgroundColor: colors.accentGreen, borderWidth: 0 },
  taskLabel: { color: colors.text, fontSize: 13, lineHeight: 18 },
  taskLabelDone: { textDecorationLine: "line-through", color: colors.textMuted },
  taskMeta: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  iconBtn: { padding: 6 },
  clearDone: { alignSelf: "center", paddingVertical: 8, marginTop: 4 },
  clearDoneText: { color: colors.textMuted, fontSize: 12 },
});
