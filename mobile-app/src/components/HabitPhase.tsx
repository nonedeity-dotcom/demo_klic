import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { phaseFor, PHASE_RANGE } from "../lib/phase";

/**
 * Says what the streak number means, right under it.
 *
 * "12 дней подряд" is a fact with no advice in it. On day 12 the useful thing
 * to know is that this is the hardest stretch and that wanting to stop is
 * expected — which is the difference between quitting and not.
 */
export default function HabitPhase({ streak }: { streak: number }) {
  const phase = phaseFor(streak);
  const accent = phase.tone === "steady" ? colors.accentGreen : colors.accent;
  const range = PHASE_RANGE[phase.id];

  return (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.header}>
        <Feather
          name={phase.tone === "steady" ? "trending-up" : "corner-down-right"}
          size={14}
          color={accent}
        />
        <Text style={[styles.title, { color: accent }]}>{phase.title}</Text>
        {range !== "" && <Text style={styles.range}>{range}</Text>}
      </View>
      <Text style={styles.body}>{phase.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderLeftWidth: 3,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 24,
    gap: 8,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  title: { fontSize: 14, fontWeight: "600" },
  range: { color: colors.textMuted, fontSize: 11 },
  body: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
