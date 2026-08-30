import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import type { Trigger } from "../types";

export default function TriggersScreen() {
  const qc = useQueryClient();
  const { data: triggers = [] } = useQuery<Trigger[]>({
    queryKey: ["triggers"],
    queryFn: () => api.getTriggers() as Promise<Trigger[]>,
  });

  const toggle = useMutation({
    mutationFn: ({ id, removed }: { id: string; removed: boolean }) => api.toggleTrigger(id, removed),
    onSettled: () => qc.invalidateQueries({ queryKey: ["triggers"] }),
  });

  const removedCount = triggers.filter((t) => t.removed).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.subtle}>
        Убрано {removedCount} из {triggers.length}
      </Text>
      <Text style={[styles.subtle, { marginTop: 4, marginBottom: 20 }]}>
        сокращай постепенно, по одному — не всё сразу
      </Text>
      {triggers.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => toggle.mutate({ id: t.id, removed: !t.removed })}
          style={[styles.card, t.removed && styles.cardRemoved]}
        >
          <View style={[styles.dot, t.removed && styles.dotRemoved]} />
          <Text style={styles.label}>{t.label}</Text>
          <Text style={styles.status}>{t.removed ? "убрал" : "ещё нет"}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtle: { color: colors.textMuted, fontSize: 13 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  cardRemoved: { backgroundColor: "rgba(143,184,154,0.12)" },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#4a5058" },
  dotRemoved: { backgroundColor: colors.accentGreen, borderWidth: 0 },
  label: { color: colors.text, fontSize: 15, fontWeight: "500", flex: 1 },
  status: { color: colors.textMuted, fontSize: 11 },
});
