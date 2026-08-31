import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import { confirmDestructive } from "../lib/confirm";
import type { Trigger } from "../types";

export default function TriggersScreen() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [newLabel, setNewLabel] = useState("");
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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.subtle}>
        Убрано {removedCount} из {triggers.length}
      </Text>
      <Text style={[styles.subtle, { marginTop: 4, marginBottom: 20 }]}>
        сокращай постепенно, по одному — не всё сразу
      </Text>
      {triggers.map((t) => {
        const isEditing = editingId === t.id;

        if (isEditing) {
          return (
            <View key={t.id} style={[styles.card, styles.cardEditing]}>
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
            <Pressable onPress={() => startEdit(t)} style={styles.iconBtn} accessibilityLabel={`Изменить: ${t.label}`}>
              <Feather name="edit-2" size={14} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => confirmRemove(t)} style={styles.iconBtn} accessibilityLabel={`Удалить: ${t.label}`}>
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
            placeholder="Новый триггер…"
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
          <Text style={styles.addRowText}>Добавить триггер</Text>
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
