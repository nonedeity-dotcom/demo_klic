import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, phaseColors, withAlpha } from "../theme/colors";
import { emptyNotice, phaseStepFor } from "../lib/phase";
import PhaseArt from "./PhaseArt";
import { milestoneProgress } from "../lib/streakProgress";
import { plural } from "../lib/plural";

const SIZE = 150;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;
/** Sits inside the ring with a hair of dark between the two, not under it. */
const ART_SIZE = SIZE - STROKE * 2 - 6;

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
  /**
   * Rendered inside the card, under the milestone line — the calendar. Given the stretch's
   * colour when it's a function, so the calendar's own toggle matches the ring above it.
   */
  children?: React.ReactNode | ((tint: string) => React.ReactNode);
}) {
  const { next, fraction } = milestoneProgress(streak);
  const step = phaseStepFor(streak);
  const notice = step === null ? emptyNotice(hasHistory) : null;
  // The ring, the card's edge and the calendar's toggle all take the stretch's colour, so
  // which one you're in registers before any of the words do. The stretch is not *named*
  // here — that is the bar's job, one block down, and saying it twice was the reason it
  // moved there in the first place.
  const tint = step ? phaseColors[step.id] : colors.cardBorder;

  return (
    <View style={[styles.card, step && { borderColor: withAlpha(tint, 0.45), backgroundColor: withAlpha(tint, 0.05) }]}>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={colors.cardBorder} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={tint}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={CIRC * (1 - fraction)}
          />
        </Svg>
        {step && (
          <View style={styles.art} pointerEvents="none">
            <PhaseArt id={step.id} size={ART_SIZE} fadeBottom />
          </View>
        )}
        {/* The number sits low over the drawing rather than dead centre: at the middle it
            landed on the busiest part of every one of them. */}
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

      {typeof children === "function" ? children(tint) : children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
  },
  ringWrap: { width: SIZE, height: SIZE, justifyContent: "center", alignItems: "center" },
  // Under the ring's own stroke, so the arc always reads on top of the drawing.
  art: { position: "absolute", width: ART_SIZE, height: ART_SIZE, borderRadius: ART_SIZE / 2, overflow: "hidden" },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "flex-end", paddingBottom: 16 },
  number: { color: colors.text, fontSize: 44, fontWeight: "700", letterSpacing: -1 },
  numberLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  noticeTitle: { color: colors.accent, fontSize: 14, fontWeight: "600", marginTop: 16, textAlign: "center" },
  noticeBody: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 6, textAlign: "center" },
  nextLine: { color: colors.textMuted, fontSize: 11, marginTop: 12 },
});
