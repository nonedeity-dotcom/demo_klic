import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "../theme/colors";
import { emptyNotice } from "../lib/phase";
import { milestoneProgress } from "../lib/streakProgress";
import { plural } from "../lib/plural";

const SIZE = 150;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

/**
 * The number and how far it is to the next milestone.
 *
 * It used to carry the current stretch's name and paragraph as well. Those moved to the
 * bar below and the Этапы screen behind it, where all four stretches sit together — here
 * the same paragraph was re-read every day and said nothing new. What stays is the notice
 * for a streak of zero, which is not a stretch but the absence of one: "never started" and
 * "just broke it" need different words, and neither belongs on a list of phases.
 */
export default function StreakRing({
  streak,
  hasHistory,
  children,
}: {
  streak: number;
  hasHistory: boolean;
  /** Rendered inside the card, under the milestone line — the calendar. */
  children?: React.ReactNode;
}) {
  const { next, fraction } = milestoneProgress(streak);
  const notice = streak <= 0 ? emptyNotice(hasHistory) : null;
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

      {notice && (
        <>
          <Text style={styles.noticeTitle}>{notice.title}</Text>
          <Text style={styles.noticeBody}>{notice.body}</Text>
        </>
      )}

      {next !== null && (streak > 0 || hasHistory) && (
        <Text style={styles.nextLine}>
          до вехи {next} — {next - streak} {plural(next - streak, ["день", "дня", "дней"])}
        </Text>
      )}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 20, alignItems: "center" },
  ringWrap: { width: SIZE, height: SIZE, justifyContent: "center", alignItems: "center" },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  number: { color: colors.accentGreen, fontSize: 44, fontWeight: "700", letterSpacing: -1 },
  numberLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  noticeTitle: { color: colors.accent, fontSize: 14, fontWeight: "600", marginTop: 16, textAlign: "center" },
  noticeBody: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 6, textAlign: "center" },
  nextLine: { color: colors.textMuted, fontSize: 11, marginTop: 12 },
});
