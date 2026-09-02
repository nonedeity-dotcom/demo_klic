import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { AUTOPILOT_DAY, PHASE_MARKS, phaseStepFor } from "../lib/phase";
import { plural } from "../lib/plural";

/**
 * The whole road, 0 to 66, with a dot where each stretch ends.
 *
 * The ring above answers "how far to the next milestone" and moves every day; this answers
 * "where am I on the whole thing", which the ring deliberately can't — measured from the
 * previous milestone, it would say the same at day 8 and day 40. The dots are what make the
 * bar more than a percentage: they say the road has named parts, and tapping opens what
 * each one is.
 */
export default function PhaseBar({ streak, onPress }: { streak: number; onPress: () => void }) {
  const pct = Math.min(100, (streak / AUTOPILOT_DAY) * 100);
  const step = phaseStepFor(streak);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Этапы: ${step ? step.title : "серии пока нет"}, ${streak} из ${AUTOPILOT_DAY} дней`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{step ? step.title : "Этапы"}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.subtle}>{step ? step.range : "путь до 66 дней"}</Text>
          <Feather name="chevron-right" size={16} color={colors.textMuted} />
        </View>
      </View>

      <View style={styles.track}>
        <View style={styles.trackLine} />
        <View style={[styles.fill, { width: `${pct}%` }]} />
        {PHASE_MARKS.map((day) => {
          const reached = streak >= day;
          return (
            <View
              key={day}
              // Pulled back by half its own width so the dot sits *on* the day, not after
              // it — at the far end that keeps 66 inside the track instead of hanging off.
              style={[styles.mark, { left: `${(day / AUTOPILOT_DAY) * 100}%` }, reached && styles.markReached]}
            />
          );
        })}
      </View>

      <View style={styles.row}>
        <Text style={styles.subtleSmall}>
          {streak} {plural(streak, ["день", "дня", "дней"])}
        </Text>
        <Text style={styles.subtleSmall}>{AUTOPILOT_DAY} — привычка держится сама</Text>
      </View>
    </Pressable>
  );
}

const MARK_SIZE = 10;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
    marginBottom: 10,
  },
  pressed: { opacity: 0.75 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { color: colors.text, fontSize: 14, fontWeight: "600" },
  subtle: { color: colors.textMuted, fontSize: 11 },
  // The track carries the dots, so it can't clip them: the fill gets the rounding instead.
  // Every child is placed with an explicit `top` — an absolute box with no inset falls back
  // to the parent's alignment in Yoga but to CSS static position on web, and the two don't
  // agree.
  track: { height: MARK_SIZE, backgroundColor: "transparent" },
  trackLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: (MARK_SIZE - 6) / 2,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cardBorder,
  },
  fill: {
    position: "absolute",
    left: 0,
    top: (MARK_SIZE - 6) / 2,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentGreen,
  },
  mark: {
    position: "absolute",
    top: 0,
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    marginLeft: -MARK_SIZE / 2,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.cardBorder,
  },
  markReached: { borderColor: colors.accentGreen, backgroundColor: colors.accentGreen },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  subtleSmall: { color: colors.textMuted, fontSize: 11 },
});
