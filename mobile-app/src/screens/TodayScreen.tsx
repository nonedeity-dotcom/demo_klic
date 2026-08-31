import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import { confirmDestructive } from "../lib/confirm";
import { useTodayKey } from "../lib/useTodayKey";
import { syncScreenTimeHabit } from "../integrations/screenTime";
import type { Habit, HabitLog } from "../types";

export default function TodayScreen() {
  const qc = useQueryClient();
  const today = useTodayKey();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: habits = [] } = useQuery<Habit[]>({
    queryKey: ["habits"],
    queryFn: () => api.getHabits() as Promise<Habit[]>,
  });

  const { data: logs = [] } = useQuery<HabitLog[]>({
    queryKey: ["habitLog", today],
    queryFn: () => api.getHabitLog(today, today) as Promise<HabitLog[]>,
  });

  const invalidateHabits = () => qc.invalidateQueries({ queryKey: ["habits"] });

  useEffect(() => {
    if (habits.length === 0) return;
    syncScreenTimeHabit(habits, today).then((synced) => {
      if (synced) qc.invalidateQueries({ queryKey: ["habitLog", today] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits.length, today]);

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
    // Invalidate the whole habitLog prefix, not just today's key: the report
    // screen keeps its own week/streak queries, and ticking a habit here left
    // them showing yesterday's numbers until their cache happened to expire.
    onSettled: () => qc.invalidateQueries({ queryKey: ["habitLog"] }),
  });

  const addHabit = useMutation({
    mutationFn: (label: string) => api.addHabit(label),
    onSuccess: () => {
      setNewLabel("");
      setAdding(false);
      invalidateHabits();
    },
  });

  const updateHabit = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) => api.updateHabit(id, { label }),
    onSuccess: () => {
      setEditingId(null);
      invalidateHabits();
    },
  });

  const removeHabit = useMutation({
    mutationFn: (id: string) => api.removeHabit(id),
    // Removing a habit now also drops its history, so today's count stops
    // including habits that no longer exist — invalidate both queries.
    onSuccess: () => {
      invalidateHabits();
      qc.invalidateQueries({ queryKey: ["habitLog"] });
    },
  });

  // A single mis-tap on the trash icon used to delete a habit and its whole
  // history instantly, with no undo.
  const confirmRemove = (h: Habit) =>
    confirmDestructive("Удалить привычку?", `«${h.label}» и её отметки за все дни будут удалены.`, () =>
      removeHabit.mutate(h.id),
    );

  const startEdit = (h: Habit) => {
    setEditingId(h.id);
    setEditDraft(h.label);
  };

  const saveEdit = () => {
    if (editingId && editDraft.trim()) updateHabit.mutate({ id: editingId, label: editDraft.trim() });
    else setEditingId(null);
  };

  const submitNew = () => {
    if (newLabel.trim()) addHabit.mutate(newLabel.trim());
    else setAdding(false);
  };

  // Count only habits that still exist: a stale log for a deleted habit used
  // to keep inflating this ("1 из 9" right after deleting the one ticked
  // habit). removeHabit purges logs now, but this also covers logs left over
  // from before the fix.
  const habitIds = new Set(habits.map((h) => h.id));
  const doneCount = logs.filter((l) => l.done && habitIds.has(l.habitId)).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.subtle}>
        Сегодня выполнено {doneCount} из {habits.length}
      </Text>
      <View style={{ height: 16 }} />
      {habits.map((h) => {
        const checked = !!logs.find((l) => l.habitId === h.id)?.done;
        const isEditing = editingId === h.id;

        if (isEditing) {
          return (
            <View key={h.id} style={[styles.card, styles.cardEditing]}>
              <TextInput
                value={editDraft}
                onChangeText={setEditDraft}
                autoFocus
                style={styles.editInput}
                placeholderTextColor={colors.textMuted}
                onSubmitEditing={saveEdit}
              />
              <Pressable onPress={saveEdit} style={styles.iconBtn}>
                <Feather name="check" size={16} color={colors.accentGreen} />
              </Pressable>
              <Pressable onPress={() => setEditingId(null)} style={styles.iconBtn}>
                <Feather name="x" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          );
        }

        return (
          <View key={h.id} style={[styles.card, checked && styles.cardChecked]}>
            <Pressable
              onPress={() => toggle.mutate({ habitId: h.id, done: !checked })}
              style={styles.cardMain}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={h.label}
            >
              <View style={[styles.checkbox, checked && styles.checkboxChecked]} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                  <Text style={[styles.label, { flexShrink: 1 }]}>{h.label}</Text>
                  {h.auto === "screentime" && (
                    <View style={styles.autoTag}>
                      <Feather name="smartphone" size={9} color={colors.textMuted} />
                      <Text style={styles.autoTagText}>Creker</Text>
                    </View>
                  )}
                </View>
                {!!h.hint && <Text style={styles.hint}>{h.hint}</Text>}
              </View>
            </Pressable>
            <Pressable onPress={() => startEdit(h)} style={styles.iconBtn} accessibilityLabel={`Изменить: ${h.label}`}>
              <Feather name="edit-2" size={14} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => confirmRemove(h)} style={styles.iconBtn} accessibilityLabel={`Удалить: ${h.label}`}>
              <Feather name="trash-2" size={14} color={colors.textMuted} />
            </Pressable>
          </View>
        );
      })}

      {adding ? (
        <View style={[styles.card, styles.cardEditing]}>
          <TextInput
            value={newLabel}
            onChangeText={setNewLabel}
            autoFocus
            placeholder="Новая привычка…"
            placeholderTextColor={colors.textMuted}
            style={styles.editInput}
            onSubmitEditing={submitNew}
          />
          <Pressable onPress={submitNew} style={styles.iconBtn}>
            <Feather name="check" size={16} color={colors.accentGreen} />
          </Pressable>
          <Pressable onPress={() => setAdding(false)} style={styles.iconBtn}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setAdding(true)} style={styles.addRow}>
          <Feather name="plus" size={16} color={colors.textMuted} />
          <Text style={styles.addRowText}>Добавить привычку</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtle: { color: colors.textMuted, fontSize: 13 },
  card: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  cardMain: { flexDirection: "row", gap: 12, alignItems: "flex-start", flex: 1 },
  cardChecked: { backgroundColor: "rgba(143,184,154,0.12)", borderColor: colors.accentGreenDark },
  cardEditing: { borderColor: colors.accent },
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
  autoTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.bg,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  autoTagText: { color: colors.textMuted, fontSize: 9, fontWeight: "600" },
  iconBtn: { padding: 6 },
  editInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 2 },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderStyle: "dashed",
  },
  addRowText: { color: colors.textMuted, fontSize: 14 },
});
