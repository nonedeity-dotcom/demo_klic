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
  /** Whether the per-row pencil and bin are on show. Off by default, and off again on exit. */
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editMinimal, setEditMinimal] = useState("");
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
    // manual=true: every tick on this screen is a person's decision, and the creker sync
    // must not overrule it later in the day.
    mutationFn: ({ habitId, done, minimal }: { habitId: string; done: boolean; minimal?: boolean }) =>
      api.toggleHabit(habitId, today, done, minimal ?? false, true),
    // Optimistic update so the checkbox feels instant instead of waiting
    // on a round trip — same snappy feel as the original local-storage demo.
    onMutate: async ({ habitId, done, minimal }) => {
      await qc.cancelQueries({ queryKey: ["habitLog", today] });
      const prev = qc.getQueryData<HabitLog[]>(["habitLog", today]) || [];
      const flag = done && !!minimal;
      const next = prev.some((l) => l.habitId === habitId)
        ? prev.map((l) => (l.habitId === habitId ? { ...l, done, minimal: flag } : l))
        : [...prev, { id: "temp", habitId, date: today, done, minimal: flag }];
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
    mutationFn: ({ id, label, minimal }: { id: string; label: string; minimal: string | null }) =>
      api.updateHabit(id, { label, minimal }),
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
    setEditMinimal(h.minimal ?? "");
  };

  const saveEdit = () => {
    if (editingId && editDraft.trim()) {
      updateHabit.mutate({
        id: editingId,
        label: editDraft.trim(),
        // Empty means "no minimal version", not an empty string to render.
        minimal: editMinimal.trim() || null,
      });
    } else setEditingId(null);
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
      {/* The pencil and the bin used to sit in every row, permanently, next to the thing you
          tap ten times a week. One button puts them behind a deliberate act instead. */}
      <View style={styles.headerRow}>
        <Text style={styles.subtle}>
          Сегодня выполнено {doneCount} из {habits.length}
        </Text>
        <Pressable
          onPress={() => {
            setEditing((v) => !v);
            setEditingId(null);
          }}
          accessibilityRole="button"
          accessibilityLabel={editing ? "Выйти из редактирования" : "Редактировать список"}
          style={({ pressed }) => [styles.editToggle, editing && styles.editToggleOn, pressed && styles.pressed]}
        >
          <Feather name={editing ? "check" : "edit-2"} size={13} color={editing ? colors.bg : colors.textMuted} />
          <Text style={[styles.editToggleText, editing && styles.editToggleTextOn]}>
            {editing ? "Готово" : "Изменить"}
          </Text>
        </Pressable>
      </View>
      <View style={{ height: 16 }} />
      {habits.map((h) => {
        const log = logs.find((l) => l.habitId === h.id);
        const checked = !!log?.done;
        const asMinimal = checked && !!log?.minimal;
        const isEditing = editingId === h.id;

        if (isEditing) {
          return (
            <View key={h.id} style={styles.editCard}>
              <View style={styles.editRow}>
                <TextInput
                  value={editDraft}
                  onChangeText={setEditDraft}
                  autoFocus
                  style={styles.editInput}
                  placeholderTextColor={colors.textMuted}
                  onSubmitEditing={saveEdit}
                />
                <Pressable onPress={saveEdit} style={styles.iconBtn} accessibilityLabel="Сохранить привычку">
                  <Feather name="check" size={16} color={colors.accentGreen} />
                </Pressable>
                <Pressable onPress={() => setEditingId(null)} style={styles.iconBtn} accessibilityLabel="Отменить">
                  <Feather name="x" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
              {/* Declared here, ahead of time, because on the day you need a
                  smaller version you will not be in the mood to invent one. */}
              <TextInput
                value={editMinimal}
                onChangeText={setEditMinimal}
                placeholder="Минимальный вариант на плохой день…"
                placeholderTextColor={colors.textMuted}
                style={[styles.editInput, styles.editMinimalInput]}
                accessibilityLabel="Минимальный вариант"
                onSubmitEditing={saveEdit}
              />
            </View>
          );
        }

        return (
          <View key={h.id} style={styles.habitBlock}>
          <View style={[styles.card, checked && styles.cardChecked]}>
            <Pressable
              onPress={() => toggle.mutate({ habitId: h.id, done: !checked })}
              style={styles.cardMain}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={h.label}
            >
              {/* A minimal day is marked with a ring rather than a filled dot:
                  it counts, but it shouldn't look identical to a full one. */}
              <View
                style={[
                  styles.checkbox,
                  checked && !asMinimal && styles.checkboxChecked,
                  asMinimal && styles.checkboxMinimal,
                ]}
              />
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

            {editing && (
              <>
                <Pressable onPress={() => startEdit(h)} style={styles.iconBtn} accessibilityLabel={`Изменить: ${h.label}`}>
                  <Feather name="edit-2" size={14} color={colors.textMuted} />
                </Pressable>
                <Pressable onPress={() => confirmRemove(h)} style={styles.iconBtn} accessibilityLabel={`Удалить: ${h.label}`}>
                  <Feather name="trash-2" size={14} color={colors.textMuted} />
                </Pressable>
              </>
            )}
          </View>

          {/* Only where a minimal version was declared. Ticking it keeps the
              chain alive on a day the full version isn't happening — the
              whole point of step 4 of the protocol. */}
          {!!h.minimal && !(checked && !asMinimal) && (
            <Pressable
              onPress={() => toggle.mutate({ habitId: h.id, done: !asMinimal, minimal: true })}
              accessibilityRole="button"
              accessibilityState={{ selected: asMinimal }}
              accessibilityLabel={
                asMinimal ? `Снять отметку по минимуму: ${h.label}` : `Отметить по минимуму: ${h.minimal}`
              }
              style={({ pressed }) => [styles.minimalPill, asMinimal && styles.minimalPillOn, pressed && styles.dimmed]}
            >
              <Feather
                name={asMinimal ? "check" : "corner-down-right"}
                size={11}
                color={asMinimal ? colors.accentGreen : colors.textMuted}
              />
              <Text style={[styles.minimalText, asMinimal && styles.minimalTextOn]}>
                {asMinimal ? `По минимуму: ${h.minimal}` : `Минимум: ${h.minimal}`}
              </Text>
            </Pressable>
          )}
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  editToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  editToggleOn: { backgroundColor: colors.accentGreen, borderColor: colors.accentGreen },
  editToggleText: { color: colors.textMuted, fontSize: 12 },
  editToggleTextOn: { color: colors.bg, fontWeight: "600" },
  pressed: { opacity: 0.75 },

  subtle: { color: colors.textMuted, fontSize: 13 },
  habitBlock: { marginBottom: 10 },
  editCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  editMinimalInput: { fontSize: 12, color: colors.textMuted },
  checkboxMinimal: { borderColor: colors.accentGreen, borderWidth: 2, backgroundColor: "transparent" },
  minimalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 6,
    marginLeft: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  minimalPillOn: { backgroundColor: "rgba(143,184,154,0.12)" },
  minimalText: { color: colors.textMuted, fontSize: 11, flexShrink: 1 },
  minimalTextOn: { color: colors.accentGreen },
  dimmed: { opacity: 0.7 },
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
  cardInBlock: { marginBottom: 0 },
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
