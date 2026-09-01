import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "../theme/colors";
import { phaseFor, PHASE_RANGE } from "../lib/phase";
import { milestoneProgress } from "../lib/streakProgress";
import { plural } from "../lib/plural";

const SIZE = 150;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

/**
 * The whole "where am I" answer in one block: the number, how far it is
 * between milestones, and what that stretch is called.
 *
 * Replaces three consecutive blocks that all said the same thing in different
 * shapes — the milestone dots, the "N из M дней до вехи" line, and the phase
 * card underneath them.
 */
export default function StreakRing({ streak, hasHistory }: { streak: number; hasHistory: boolean }) {
  const phase = phaseFor(streak, hasHistory);
  const { next, fraction } = milestoneProgress(streak);
  const accent = phase.tone === "steady" ? colors.accentGreen : colors.accent;
  const ringColor = streak > 0 ? colors.accentGreen : colors.cardBorder;

  return (
    <View style={styles.card}>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={colors.cardBorder} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={ringColor}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={CIRC * (1 - fraction)}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={styles.number}>{streak}</Text>
          <Text style={styles.numberLabel}>{plural(streak, ["день", "дня", "дней"])} подряд</Text>
        </View>
      </View>

      <Text style={[styles.phaseTitle, { color: accent }]}>
        {phase.title}
        {PHASE_RANGE[phase.id] ? ` · ${PHASE_RANGE[phase.id]}` : ""}
      </Text>
      <Text style={styles.phaseBody}>{phase.body}</Text>

      {next !== null && phase.id !== "empty" && (
        <Text style={styles.nextLine}>
          до вехи {next} — {next - streak} {plural(next - streak, ["день", "дня", "дней"])}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 20, alignItems: "center" },
  ringWrap: { width: SIZE, height: SIZE, justifyContent: "center", alignItems: "center" },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  number: { color: colors.accentGreen, fontSize: 44, fontWeight: "700", letterSpacing: -1 },
  numberLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  phaseTitle: { fontSize: 14, fontWeight: "600", marginTop: 16, textAlign: "center" },
  phaseBody: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 6, textAlign: "center" },
  nextLine: { color: colors.textMuted, fontSize: 11, marginTop: 12 },
});
