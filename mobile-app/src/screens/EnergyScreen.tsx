import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import type { EnergyLog } from "../types";

const WAKE_HOUR = 7;
const SLEEP_HOUR = 23;
const HOURS = Array.from({ length: SLEEP_HOUR - WAKE_HOUR + 1 }, (_, i) => WAKE_HOUR + i);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function EnergyScreen() {
  const qc = useQueryClient();
  const today = todayKey();

  const { data: logs = [] } = useQuery<EnergyLog[]>({
    queryKey: ["energy", today],
    queryFn: () => api.getEnergy(today, today) as Promise<EnergyLog[]>,
  });

  const setEnergy = useMutation({
    mutationFn: ({ hour, value }: { hour: number; value: number }) => api.setEnergy(today, hour, value),
    onSettled: () => qc.invalidateQueries({ queryKey: ["energy", today] }),
  });

  const valueFor = (hour: number) => logs.find((l) => l.hour === hour)?.value || 0;

  const set = logs.filter((l) => l.value > 0);
  const peakHour = set.length ? set.reduce((a, b) => (b.value > a.value ? b : a)).hour : null;
  const dipHour = set.length ? set.reduce((a, b) => (b.value < a.value ? b : a)).hour : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.subtle}>Отметь уровень энергии по часам</Text>
      <Text style={[styles.subtle, { marginBottom: 20 }]}>
        так видно пики (сложные задачи) и спады (рутина)
      </Text>

      <View style={styles.hintCard}>
        {set.length >= 2 ? (
          <>
            <Text style={styles.hintText}>
              <Text style={{ color: colors.accentGreen, fontWeight: "700" }}>Пик в {peakHour}:00</Text> — ставь сюда
              сложные аналитические задачи.
            </Text>
            <Text style={[styles.hintText, { marginTop: 4 }]}>
              <Text style={{ color: colors.accent, fontWeight: "700" }}>Спад в {dipHour}:00</Text> — подходит для
              рутины.
            </Text>
          </>
        ) : (
          <Text style={styles.hintText}>
            Отмечай энергию 3-5 дней подряд, чтобы увидеть свои реальные пики и спады.
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
                  >
                    <Text style={styles.presetText}>{preset}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtle: { color: colors.textMuted, fontSize: 13 },
  hintCard: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 20 },
  hintText: { color: colors.text, fontSize: 12, lineHeight: 17 },
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
  presetText: { fontSize: 8, color: colors.textMuted },
});
