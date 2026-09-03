import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, phaseColors, withAlpha } from "../theme/colors";
import { useTodayKey } from "../lib/useTodayKey";
import { plural } from "../lib/plural";
import { useStreak } from "../lib/useStreak";
import { AUTOPILOT_DAY, PHASE_STEPS, phaseStepFor } from "../lib/phase";
import PhaseArt from "../components/PhaseArt";

/**
 * What the four stretches are, with the one you're in marked.
 *
 * The report used to carry the current stretch's paragraph inline, above the bar. It said
 * the right thing but only ever about today, and it said it every single day — so it moved
 * here, where all four sit next to each other and the bar on the report points at it.
 */
export default function PhasesScreen() {
  const today = useTodayKey();
  const { streak } = useStreak(today);
  const current = phaseStepFor(streak);
  const currentTint = current ? phaseColors[current.id] : colors.textMuted;
  const left = Math.max(0, AUTOPILOT_DAY - streak);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.intro}>
        Границы приблизительные: в источнике названы сами этапы и то, что первые две недели самые
        трудные, а 66 дней — ориентир, после которого привычка держится сама. Точных дат он не даёт.
      </Text>

      {PHASE_STEPS.map((step) => {
        const active = current?.id === step.id;
        const tint = phaseColors[step.id];
        return (
          <View
            key={step.id}
            style={[styles.card, { borderColor: withAlpha(tint, active ? 0.85 : 0.4), backgroundColor: withAlpha(tint, active ? 0.1 : 0.05) }]}
          >
            <PhaseArt id={step.id} size={ART_SIZE} />
            <View style={styles.cardText}>
              <View style={styles.headRow}>
                <Text style={[styles.title, { color: tint }]}>{step.title}</Text>
                {active && (
                  <Text style={[styles.badge, { color: tint, backgroundColor: withAlpha(tint, 0.16) }]}>ты здесь</Text>
                )}
              </View>
              <Text style={styles.range}>{step.range}</Text>
              <Text style={styles.body}>{step.body}</Text>
            </View>
          </View>
        );
      })}

      <View style={styles.footer}>
        <Feather name="calendar" size={14} color={colors.textMuted} />
        <Text style={styles.footerText}>
          {streak > 0 ? (
            <>
              Сейчас <Text style={{ color: currentTint }}>{streak} {plural(streak, ["день", "дня", "дней"])} подряд</Text>
              {" — до "}
              {AUTOPILOT_DAY} осталось{" "}
              <Text style={{ color: currentTint }}>
                {left} {plural(left, ["день", "дня", "дней"])}
              </Text>
              .
            </>
          ) : (
            "Серии пока нет — этапы начнутся с первого отмеченного дня."
          )}
        </Text>
      </View>

    </ScrollView>
  );
}

/** Big enough to read the drawing, small enough that four cards still fit on one screen. */
const ART_SIZE = 84;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  intro: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 16 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardText: { flex: 1 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 17, fontWeight: "700" },
  badge: {
    fontSize: 11,
    overflow: "hidden",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  range: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  body: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  footer: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 6 },
  footerText: { color: colors.textMuted, fontSize: 12, lineHeight: 18, flex: 1 },
});
