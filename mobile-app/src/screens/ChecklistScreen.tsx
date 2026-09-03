import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors } from "../theme/colors";
import TodayScreen from "./TodayScreen";
import TriggersScreen from "./TriggersScreen";

type Half = "rules" | "triggers";

/**
 * The two halves of "what I do today" behind one tab: the habits to tick and the triggers
 * to remove. They were separate tabs, which put six labels in the bottom bar — at 8pt on a
 * 320px screen — for two lists that are the same daily subject seen from two sides.
 *
 * The switch is the same chip pair the calendar uses for its month/weeks toggle, so a
 * two-way choice looks the same everywhere in the app.
 */
export default function ChecklistScreen() {
  const [half, setHalf] = useState<Half>("rules");

  // Always opens on the rules. The triggers list is something you visit now and then; the
  // habits are the thing there is a reason to open the app for, and finding the tab showing
  // yesterday's detour is how a day goes unticked.
  useFocusEffect(
    useCallback(() => {
      setHalf("rules");
    }, []),
  );

  return (
    <View style={styles.container}>
      <View style={styles.switchRow}>
        {(
          [
            ["rules", "Мои правила"],
            ["triggers", "Триггеры"],
          ] as [Half, string][]
        ).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => setHalf(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: half === value }}
            style={({ pressed }) => [styles.chip, half === value && styles.chipOn, pressed && styles.dimmed]}
          >
            <Text style={[styles.chipText, half === value && styles.chipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {half === "rules" ? <TodayScreen /> : <TriggersScreen />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  switchRow: { flexDirection: "row", gap: 8, justifyContent: "center", paddingTop: 12, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: "rgba(143,184,154,0.12)", borderColor: colors.accentGreen },
  chipText: { color: colors.textMuted, fontSize: 13 },
  chipTextOn: { color: colors.accentGreen, fontWeight: "600" },
  dimmed: { opacity: 0.7 },
});
