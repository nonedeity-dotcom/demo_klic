import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import { confirmDestructive } from "../lib/confirm";
import { itemGroup } from "../lib/habits";
import type { ItemGroup, Trigger } from "../types";

/** The same three piles as the habits — see ItemGroup. Triggers never affect the day. */
const GROUPS: { id: ItemGroup; title: string; blurb: string }[] = [
  { id: "now", title: "Убираю сейчас", blurb: "то, над чем работаешь прямо сейчас" },
  { id: "extra", title: "Дополнительно", blurb: "убрал попутно, специально не занимаешься" },
  { id: "later", title: "Потом", blurb: "знаешь, что мешает, но очередь ещё не дошла" },
];

export default function TriggersScreen() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [newLabel, setNewLabel] = useState("");
  /** Whether the per-row pencil and bin are on show. Off by default, and off again on exit. */
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  const { data: triggers = [] } = useQuery<Trigger[]>({
    queryKey: ["triggers"],
    queryFn: () => api.getTriggers() as Promise<Trigger[]>,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["triggers"] });

  const toggle = useMutation({
    mutationFn: ({ id, removed }: { id: string; removed: boolean }) => api.toggleTrigger(id, removed),
    onSettled: invalidate,
  });

  const addTrigger = useMutation({
    mutationFn: (label: string) => api.addTrigger(label),
    onSuccess: () => {
      setNewLabel("");
      setAdding(false);
      invalidate();
    },
  });

  const updateTrigger = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) => api.updateTrigger(id, label),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
  });

  const setGroup = useMutation({
    mutationFn: ({ id, group }: { id: string; group: ItemGroup }) => api.setTriggerGroup(id, group),
    onSettled: invalidate,
  });

  const removeTrigger = useMutation({
    mutationFn: (id: string) => api.removeTrigger(id),
    onSuccess: invalidate,
  });

  // Same as on the checklist: the trash icon sits next to the edit icon, and a
  // mis-tap used to delete outright.
  const confirmRemove = (t: Trigger) =>
    confirmDestructive("Удалить триггер?", `«${t.label}» будет удалён из списка.`, () =>
      removeTrigger.mutate(t.id),
    );

  const startEdit = (t: Trigger) => {
    setEditingId(t.id);
    setEditDraft(t.label);
  };

  const saveEdit = () => {
    if (editingId && editDraft.trim()) updateTrigger.mutate({ id: editingId, label: editDraft.trim() });
    else setEditingId(null);
  };

  const submitNew = () => {
    if (newLabel.trim()) addTrigger.mutate(newLabel.trim());
    else setAdding(false);
  };

  const removedCount = triggers.filter((t) => t.removed).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}>
      {/* Same as on the checklist: the pencil and the bin live behind one button rather than
          sitting in every row next to the thing you tap. */}
      <View style={styles.headerRow}>
        <Text style={styles.subtle}>
          Убрано {removedCount} из {triggers.length}
        </Text>
        <Pressable
          onPress={() => {
            setEditing((v) => !v);
            setEditingId(null);
            setAdding(false);
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
      <Text style={[styles.subtle, { marginTop: 4, marginBottom: 20 }]}>
        сокращай постепенно, по одному — не всё сразу
      </Text>
      {GROUPS.map((group) => {
        const inGroup = triggers.filter((t) => itemGroup(t) === group.id);
        // An empty pile is only worth a heading while you are sorting things into it.
        if (inGroup.length === 0 && !editing) return null;
        return (
          <View key={group.id} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <Text style={styles.groupBlurb}>{group.blurb}</Text>
            {inGroup.length === 0 && <Text style={styles.groupEmpty}>пусто</Text>}
            {inGroup.map((t) => {
              if (editingId === t.id) {
                return (
                  <View key={t.id} style={[styles.card, styles.cardEditing, styles.editStack]}>
                    <View style={styles.editRow}>
                      <TextInput
                        value={editDraft}
                        onChangeText={setEditDraft}
                        autoFocus
                        style={styles.editInput}
                        placeholderTextColor={colors.textMuted}
                        onSubmitEditing={saveEdit}
                      />
                      <Pressable onPress={saveEdit} style={styles.iconBtn} accessibilityLabel="Сохранить">
                        <Feather name="check" size={16} color={colors.accentGreen} />
                      </Pressable>
                      <Pressable onPress={() => setEditingId(null)} style={styles.iconBtn} accessibilityLabel="Отменить">
                        <Feather name="x" size={16} color={colors.textMuted} />
                      </Pressable>
                    </View>
                    <View style={styles.chipRow}>
                      {GROUPS.map((g) => (
                        <Pressable
                          key={g.id}
                          onPress={() => setGroup.mutate({ id: t.id, group: g.id })}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: itemGroup(t) === g.id }}
                          style={({ pressed }) => [
                            styles.chip,
                            itemGroup(t) === g.id && styles.chipOn,
                            pressed && styles.dimmed,
                          ]}
                        >
                          <Text style={[styles.chipText, itemGroup(t) === g.id && styles.chipTextOn]}>{g.title}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              }

              return (
                <View key={t.id} style={[styles.card, t.removed && styles.cardRemoved]}>
                  <Pressable
                    onPress={() => toggle.mutate({ id: t.id, removed: !t.removed })}
                    style={styles.cardMain}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: t.removed }}
                    accessibilityLabel={t.label}
                  >
                    <View style={[styles.dot, t.removed && styles.dotRemoved]} />
                    <Text style={styles.label}>{t.label}</Text>
                    <Text style={styles.status}>{t.removed ? "убрал" : "ещё нет"}</Text>
                  </Pressable>
                  {editing && (
                    <>
                      <Pressable onPress={() => startEdit(t)} style={styles.iconBtn} accessibilityLabel={`Изменить: ${t.label}`}>
                        <Feather name="edit-2" size={14} color={colors.textMuted} />
                      </Pressable>
                      <Pressable onPress={() => confirmRemove(t)} style={styles.iconBtn} accessibilityLabel={`Удалить: ${t.label}`}>
                        <Feather name="trash-2" size={14} color={colors.textMuted} />
                      </Pressable>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}

      {/* Adding is an edit, so it lives with the other edits rather than sitting under the
          list every day of the year. */}
      {editing &&
        (adding ? (
          <View style={[styles.card, styles.cardEditing]}>
            <TextInput
              value={newLabel}
              onChangeText={setNewLabel}
              autoFocus
              placeholder="Новый триггер…"
              placeholderTextColor={colors.textMuted}
              style={styles.editInput}
              onSubmitEditing={submitNew}
            />
            <Pressable onPress={submitNew} style={styles.iconBtn} accessibilityLabel="Сохранить триггер">
              <Feather name="check" size={16} color={colors.accentGreen} />
            </Pressable>
            <Pressable onPress={() => setAdding(false)} style={styles.iconBtn} accessibilityLabel="Отменить">
              <Feather name="x" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setAdding(true)} style={styles.addRow} accessibilityRole="button">
            <Feather name="plus" size={16} color={colors.textMuted} />
            <Text style={styles.addRowText}>Добавить триггер</Text>
          </Pressable>
        ))}

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
  group: { marginTop: 22 },
  groupTitle: { color: colors.text, fontSize: 13, fontWeight: "600" },
  groupBlurb: { color: colors.textMuted, fontSize: 11, marginTop: 2, marginBottom: 10 },
  groupEmpty: { color: colors.textMuted, fontSize: 12, fontStyle: "italic", marginBottom: 10 },
  editStack: { flexDirection: "column", alignItems: "stretch", gap: 10 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bg,
  },
  chipOn: { backgroundColor: "rgba(143,184,154,0.12)", borderColor: colors.accentGreen },
  chipText: { color: colors.textMuted, fontSize: 12 },
  chipTextOn: { color: colors.accentGreen, fontWeight: "600" },
  dimmed: { opacity: 0.7 },

  subtle: { color: colors.textMuted, fontSize: 13 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  cardMain: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  cardRemoved: { backgroundColor: "rgba(143,184,154,0.12)" },
  cardEditing: { borderColor: colors.accent },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#4a5058" },
  dotRemoved: { backgroundColor: colors.accentGreen, borderWidth: 0 },
  label: { color: colors.text, fontSize: 15, fontWeight: "500", flex: 1 },
  status: { color: colors.textMuted, fontSize: 11 },
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
