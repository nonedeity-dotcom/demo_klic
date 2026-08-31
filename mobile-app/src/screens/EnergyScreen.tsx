import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import { dateNDaysAgo } from "../lib/date";
import { useTodayKey } from "../lib/useTodayKey";
import type { EnergyLog } from "../types";

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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
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
});
