import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import TwoCurves from "./TwoCurves";
import type { Tip } from "../content/library";

/**
 * One tip: a single line you can read at a glance, and the paragraph behind it
 * once you tap. Collapsed by default everywhere — the app is about less to
 * look at, so the reference shouldn't open as a wall of text either.
 */
export default function TipCard({
  tip,
  expanded,
  onToggle,
  number,
}: {
  tip: Tip;
  expanded: boolean;
  onToggle: () => void;
  /** Position in the rotation, when the tip has one. */
  number?: number | null;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={tip.short}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        {/* The rotation advances on every app open, so the number is the only
            way to tell where in the loop you are. */}
        {number != null && <Text style={styles.number}>{number}</Text>}
        <Text style={styles.short}>{tip.short}</Text>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textMuted}
          style={styles.chevron}
        />
      </View>
      {expanded && (
        <>
          <Text style={styles.full}>{tip.full}</Text>
          {/* Where a source states its author's opinion as fact, the tip says
              so rather than letting the app vouch for it. */}
          {tip.illustration === "two-curves" && (
            <View style={styles.illustration}>
              <TwoCurves />
            </View>
          )}
          {tip.caveat && <Text style={styles.caveat}>{tip.caveat}</Text>}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  pressed: { opacity: 0.75 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  number: {
    color: colors.textMuted,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    minWidth: 18,
    marginTop: 3,
  },
  short: { color: colors.text, fontSize: 14, lineHeight: 19, flex: 1 },
  chevron: { marginTop: 2 },
  full: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 10 },
  illustration: { alignItems: "center", marginTop: 12 },
  caveat: {
    color: colors.accent,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
  },
});
