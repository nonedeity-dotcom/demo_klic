import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, STREAK_MILESTONES } from "../api/client";
import { colors } from "../theme/colors";
import { dateNDaysAgo, weekdayLabel } from "../lib/date";
import { plural } from "../lib/plural";
import { useTodayKey } from "../lib/useTodayKey";
import TwoCurves from "../components/TwoCurves";
import RotatingTip from "../components/RotatingTip";
import type { Habit, HabitLog, FocusSession } from "../types";

export default function ReportScreen() {
  const qc = useQueryClient();
  // Re-renders when the local day turns over, so a report left open overnight
  // rolls onto the new week instead of freezing on yesterday.
  const today = useTodayKey();
  const weekStart = dateNDaysAgo(6);
  const streakWindowStart = dateNDaysAgo(120); // long enough to reach the 66-day milestone

  const { data: habits = [] } = useQuery<Habit[]>({ queryKey: ["habits"], queryFn: () => api.getHabits() as Promise<Habit[]> });
  // The date range belongs in the key: with a constant "week"/"streak" key,
  // React Query happily served the previous day's cached rows after midnight,
  // because only the closure changed and nothing told it to refetch.
  const { data: logs = [] } = useQuery<HabitLog[]>({
    queryKey: ["habitLog", "week", weekStart, today],
    queryFn: () => api.getHabitLog(weekStart, today) as Promise<HabitLog[]>,
  });
  const { data: streakLogs = [] } = useQuery<HabitLog[]>({
    queryKey: ["habitLog", "streak", streakWindowStart, today],
    queryFn: () => api.getHabitLog(streakWindowStart, today) as Promise<HabitLog[]>,
  });
  const { data: sessions = [] } = useQuery<FocusSession[]>({
    queryKey: ["sessions", "week", weekStart, today],
    queryFn: () => api.getSessions(weekStart, today) as Promise<FocusSession[]>,
  });
  const { data: celebrated = [] } = useQuery<number[]>({
    queryKey: ["milestones"],
    queryFn: () => api.getCelebratedMilestones(),
  });

  // Streak: a day "counts" once at least half the habits are done that day —
  // same rule as the original demo.
  const days = Array.from({ length: 7 }, (_, i) => dateNDaysAgo(6 - i));

  // Logs of deleted habits must not count towards any of these numbers.
  const habitIds = new Set(habits.map((h) => h.id));
  const countsFor = (log: HabitLog) => log.done && habitIds.has(log.habitId);

  const doneByDay = (day: string) => logs.filter((l) => l.date === day && countsFor(l)).length;
  const sessionsByDay = (day: string) => sessions.filter((s) => s.date === day).length;

  // How many habits a day needs to "count". With no habits at all there is
  // nothing to be consistent about: the old `done >= Math.ceil(0 / 2)` was
  // `0 >= 0` — always true — so an empty checklist reported a 120-day streak
  // with every milestone ticked, and every visit here flashed that while the
  // habits query was still loading.
  const dayTarget = Math.ceil(habits.length / 2);

  let streak = 0;
  if (dayTarget > 0) {
    for (let i = 0; i < 120; i++) {
      const day = dateNDaysAgo(i);
      const done = streakLogs.filter((l) => l.date === day && countsFor(l)).length;
      if (done >= dayTarget) streak++;
      // Today still being unfinished shouldn't break yesterday's streak.
      else if (i === 0) continue;
      else break;
    }
  }

  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak);
  const [justCelebrated, setJustCelebrated] = useState<number | null>(null);

  useEffect(() => {
    const hit = STREAK_MILESTONES.find((m) => m === streak);
    if (hit && !celebrated.includes(hit)) {
      api.celebrateMilestone(hit).then(() => {
        setJustCelebrated(hit);
        // Without refreshing the list of already-celebrated milestones, the
        // cached empty array kept saying "not celebrated yet" and the banner
        // came back every time this tab was reopened.
        qc.invalidateQueries({ queryKey: ["milestones"] });
      });
    }
  }, [streak, celebrated, qc]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      {/* First thing on the first screen: one line, and the reasoning behind
          it if you tap. Steps to the next one each time the app is opened;
          the rest of the library lives in settings. */}
      <RotatingTip />

      <View style={styles.hero}>
        <TwoCurves />
        <Text style={styles.heroCaption}>
          каждый выполненный день — ещё один шаг к плавной, устойчивой кривой
        </Text>
      </View>

      {justCelebrated && (
        <View style={styles.celebration}>
          <Text style={styles.celebrationEmoji}>🔥</Text>
          <Text style={styles.celebrationText}>
            {justCelebrated} {plural(justCelebrated, ["день", "дня", "дней"])} подряд! По видео это{" "}
            {justCelebrated >= 66 ? "автопилот — привычка закрепилась" : "важная веха на пути к автопилоту"}.
          </Text>
        </View>
      )}

      <View style={styles.milestoneRow}>
        {STREAK_MILESTONES.map((m) => (
          <View key={m} style={styles.milestoneItem}>
            <View style={[styles.milestoneDot, streak >= m && styles.milestoneDotDone]}>
              {streak >= m && <Text style={styles.milestoneCheck}>✓</Text>}
            </View>
            <Text style={styles.milestoneLabel}>{m}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.subtle, { marginBottom: 20 }]}>
        {nextMilestone
          ? `${streak} из ${nextMilestone} ${plural(nextMilestone, ["дня", "дней", "дней"])} до следующей вехи`
          : "Все вехи пройдены — привычка на автопилоте"}
      </Text>

      <Text style={styles.subtle}>Последние 7 дней</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.accentGreen }]}>{streak}</Text>
          <Text style={styles.statLabel}>{plural(streak, ["день", "дня", "дней"])} подряд</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.blue }]}>{sessions.length}</Text>
          <Text style={styles.statLabel}>
            {plural(sessions.length, ["фокус-сессия", "фокус-сессии", "фокус-сессий"])}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Привычки по дням</Text>
      <View style={styles.barRow}>
        {days.map((d) => {
          const done = doneByDay(d);
          const pct = Math.max(4, (done / Math.max(1, habits.length)) * 100);
          return (
            <View key={d} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${pct}%`,
                      backgroundColor:
                        dayTarget > 0 && done >= dayTarget ? colors.accentGreen : colors.accent,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{weekdayLabel(d)}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Фокус-сессии по дням</Text>
      <View style={styles.barRow}>
        {days.map((d) => {
          const count = sessionsByDay(d);
          return (
            <View key={d} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${Math.min(100, count * 25) || 4}%`, backgroundColor: colors.blue }]} />
              </View>
              <Text style={styles.barLabel}>{count || ""}</Text>
            </View>
          );
        })}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: { alignItems: "center", marginBottom: 28, paddingVertical: 8 },
  heroCaption: { color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: 14, maxWidth: 220 },
  subtle: { color: colors.textMuted, fontSize: 13, marginBottom: 16 },
  celebration: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(224,138,85,0.14)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  celebrationEmoji: { fontSize: 24 },
  celebrationText: { color: colors.text, fontSize: 12, flex: 1, lineHeight: 17 },
  milestoneRow: { flexDirection: "row", gap: 18, marginBottom: 8 },
  milestoneItem: { alignItems: "center", gap: 4 },
  milestoneDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#4a5058",
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneDotDone: { backgroundColor: colors.accentGreen, borderWidth: 0 },
  milestoneCheck: { color: colors.bg, fontSize: 12, fontWeight: "700" },
  milestoneLabel: { color: colors.textMuted, fontSize: 10 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 14 },
  statValue: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5 },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  sectionLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 8, marginTop: 8 },
  barRow: { flexDirection: "row", gap: 8, height: 70, marginBottom: 24, alignItems: "flex-end" },
  barCol: { flex: 1, alignItems: "center", gap: 4, height: "100%" },
  barTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 4 },
  barLabel: { color: colors.textMuted, fontSize: 10 },
});
