import { View, Text, StyleSheet } from "react-native";
import { useFold } from "../lib/useFold";
import { useRotatingTip } from "../lib/useRotatingTip";
import { colors } from "../theme/colors";
import TipCard from "./TipCard";

/**
 * The tip at the top of the first screen you land on.
 *
 * It steps forward every time you open the app and starts over at the end, so
 * the number beside it is what tells you where you are — without it the
 * rotation would look like it was picking at random.
 */
export default function RotatingTip() {
  const rotating = useRotatingTip();
  // Collapsed again whenever you leave the screen — an opened tip is something you read
  // once, not a card you want permanently unfolded above the number.
  const { open, toggle } = useFold();

  if (!rotating) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        Подсказка {rotating.number} из {rotating.total}
      </Text>
      <TipCard
        tip={rotating.tip}
        number={rotating.number}
        expanded={open}
        onToggle={toggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
});
