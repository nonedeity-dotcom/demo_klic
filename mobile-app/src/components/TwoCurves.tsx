import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { colors } from "../theme/colors";

// The app's one signature visual: the "two kinds of dopamine" curve from the
// source material — a sharp artificial spike that crashes below baseline,
// versus a gentle natural rise that holds. Everything else in the UI (accent
// = spike/warm, accentGreen = steady/natural) already points at this shape;
// this is where it actually gets drawn, once, instead of staying a metaphor.
export default function TwoCurves({ width = 260, height = 92 }: { width?: number; height?: number }) {
  // The end-point marker sits exactly on the right edge, so half of it used to
  // be clipped by the viewport. Inset the drawing by the dot's radius.
  const DOT_R = 3;
  const w = width - DOT_R * 2;
  const h = height;
  const base = h * 0.62;

  // Sharp rise, sharp fall, dips under the natural line — the "upadok" after a
  // quick stimulus.
  const spike = `M0 ${base} C ${w * 0.14} ${base}, ${w * 0.2} ${h * 0.08}, ${w * 0.32} ${h * 0.08} C ${w * 0.4} ${h * 0.08}, ${w * 0.42} ${base}, ${w * 0.55} ${base + h * 0.16} C ${w * 0.68} ${base + h * 0.26}, ${w * 0.8} ${base + h * 0.22}, ${w} ${base + h * 0.2}`;

  // Gentle, sustained rise that stays elevated — no crash.
  const natural = `M0 ${base} C ${w * 0.25} ${base - h * 0.06}, ${w * 0.4} ${h * 0.42}, ${w * 0.6} ${h * 0.36} C ${w * 0.78} ${h * 0.31}, ${w * 0.9} ${h * 0.3}, ${w} ${h * 0.28}`;

  return (
    <View style={{ width, alignItems: "center" }}>
      <Svg width={width} height={h} viewBox={`${-DOT_R} 0 ${width} ${h}`}>
        <Path d={spike} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.9} />
        <Path d={natural} stroke={colors.accentGreen} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Circle cx={w * 0.32} cy={h * 0.08} r={DOT_R} fill={colors.accent} />
        <Circle cx={w} cy={h * 0.28} r={DOT_R} fill={colors.accentGreen} />
      </Svg>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendText}>резкий стимул</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.accentGreen }]} />
          <Text style={styles.legendText}>естественный ритм</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow: { flexDirection: "row", gap: 16, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { color: colors.textMuted, fontSize: 10 },
});
