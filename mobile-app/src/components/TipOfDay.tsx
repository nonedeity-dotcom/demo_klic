import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTodayKey } from "../lib/useTodayKey";
import { tipOfDay } from "../lib/tipOfDay";
import { colors } from "../theme/colors";
import TipCard from "./TipCard";

/**
 * Today's tip, at the top of the first screen you land on.
 *
 * Tied to the date, not to chance: it is the same tip all day however many
 * times you open the app, and the pool cycles in order so nothing comes back
 * until everything else has had a turn.
 */
export default function TipOfDay() {
  const today = useTodayKey();
  const tip = tipOfDay(today);
  const [expanded, setExpanded] = useState(false);

  if (!tip) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Подсказка дня</Text>
      <TipCard tip={tip} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
});
