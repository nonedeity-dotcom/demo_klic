import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { colors } from "../theme/colors";
import { ROTATION, SECTIONS, TIPS, rotationNumber, tipsInSection } from "../content/library";
import TipCard from "../components/TipCard";

/**
 * The whole reference, grouped into the four themes the app is built on.
 *
 * One section is open at a time: forty-odd tips laid out flat is exactly the
 * scrollable feed this app exists to argue against.
 */
export default function LibraryScreen() {
  const [openSection, setOpenSection] = useState<string | null>(SECTIONS[0]?.id ?? null);
  const [openTips, setOpenTips] = useState<Set<string>>(new Set());

  const toggleTip = (id: string) =>
    setOpenTips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.intro}>
        Всё, к чему подталкивает приложение, и почему. {TIPS.length} подсказок в четырёх разделах,
        из них {ROTATION.length} пронумерованы и по очереди показываются на «Отчёте» — номер слева
        от подсказки её и обозначает.
      </Text>

      {SECTIONS.map((section) => {
        const open = openSection === section.id;
        const tips = tipsInSection(section.id);
        return (
          <View key={section.id} style={styles.section}>
            <Pressable
              onPress={() => setOpenSection(open ? null : section.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBlurb}>{section.blurb}</Text>
              </View>
              <Text style={styles.sectionCount}>{tips.length}</Text>
            </Pressable>

            {open && (
              <View style={styles.sectionBody}>
                {tips.map((tip) => (
                  <TipCard
                    key={tip.id}
                    tip={tip}
                    number={rotationNumber(tip.id)}
                    expanded={openTips.has(tip.id)}
                    onToggle={() => toggleTip(tip.id)}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  intro: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 20 },
  section: { marginBottom: 10 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pressed: { opacity: 0.75 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sectionBlurb: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
  sectionCount: { color: colors.textMuted, fontSize: 12, fontVariant: ["tabular-nums"] },
  sectionBody: { marginTop: 10, paddingLeft: 10 },
});
