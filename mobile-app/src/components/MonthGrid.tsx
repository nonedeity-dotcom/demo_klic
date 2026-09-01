import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import { plural } from "../lib/plural";
import { buildMonthGrid, countedDays, weekOverWeek, GRID_WEEKS } from "../lib/monthGrid";
import type { Habit, HabitLog } from "../types";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

/**
 * Four weeks of the chain at a glance.
 *
 * A seven-day bar chart couldn't show progress towards a 66-day target, and
 * with a 4% minimum bar height a patchy week rendered as seven identical
 * dashes. A month of squares shows both the run and the holes in it.
 */
export default function MonthGrid({
  today,
  habits,
  logs,
}: {
  today: string;
  habits: Habit[];
  logs: HabitLog[];
}) {
  const days = buildMonthGrid(today, habits, logs);
  const counted = countedDays(days);
  const elapsed = days.filter((d) => d.state !== "future").length;
  const delta = weekOverWeek(days);
  const hasMinimal = days.some((d) => d.state === "minimal");

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      {Array.from({ length: GRID_WEEKS }, (_, week) => (
        <View key={week} style={styles.row}>
          {days.slice(week * 7, week * 7 + 7).map((day) => (
            <View
              key={day.date}
              style={[
                styles.cell,
                day.state === "full" && styles.cellFull,
                day.state === "minimal" && styles.cellMinimal,
                day.state === "future" && styles.cellFuture,
                day.isToday && styles.cellToday,
              ]}
            />
          ))}
        </View>
      ))}

      <View style={styles.summaryRow}>
        <Text style={styles.summary}>
          {counted} из {elapsed} {plural(elapsed, ["дня", "дней", "дней"])}
        </Text>
        {delta !== null && delta !== 0 && (
          <Text style={[styles.delta, delta < 0 && { color: colors.accent }]}>
            {delta > 0 ? "+" : ""}
            {delta} к прошлой неделе
          </Text>
        )}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.cellFull]} />
          <Text style={styles.legendText}>полностью</Text>
        </View>
        {hasMinimal && (
          <View style={styles.legendItem}>
            <View style={[styles.swatch, styles.cellMinimal]} />
            <Text style={styles.legendText}>по минимуму</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14 },
  row: { flexDirection: "row", gap: 5, marginBottom: 5 },
  weekday: { flex: 1, color: colors.textMuted, fontSize: 9, textAlign: "center", marginBottom: 2 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 5, backgroundColor: "#22262e" },
  cellFull: { backgroundColor: colors.accentGreen },
  cellMinimal: { backgroundColor: colors.accentGreenDark, opacity: 0.55 },
  cellFuture: { backgroundColor: "#1a1e25" },
  cellToday: { borderWidth: 2, borderColor: colors.accent },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  summary: { color: colors.textMuted, fontSize: 11 },
  delta: { color: colors.accentGreen, fontSize: 11 },
  legend: { flexDirection: "row", gap: 14, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { color: colors.textMuted, fontSize: 10 },
});
