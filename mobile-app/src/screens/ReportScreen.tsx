import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, STREAK_MILESTONES } from "../api/client";
import { AUTOPILOT_DAYS } from "../lib/streakProgress";
import { colors } from "../theme/colors";
import { dateNDaysAgo } from "../lib/date";
import { plural } from "../lib/plural";
import { useTodayKey } from "../lib/useTodayKey";
import { weekKey, dayOfWeek } from "../lib/week";
import RotatingTip from "../components/RotatingTip";
import StreakRing from "../components/StreakRing";
import MonthGrid from "../components/MonthGrid";
import type { Habit, HabitLog, FocusSession, WeeklyReview } from "../types";

export default function ReportScreen({ navigation }: { navigation: { navigate: (screen: string) => void } }) {
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
  const { data: reviews = [] } = useQuery<WeeklyReview[]>({
    queryKey: ["reviews"],
    queryFn: () => api.getReviews(),
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

  const sessionsByDay = (day: string) => sessions.filter((s) => s.date === day).length;
  const hasHistory = streakLogs.some(countsFor);

  const reviewWritten = reviews.some((r) => r.week === weekKey(today));
  // Friday onwards: earlier in the week there is not much of a week to review.
  const reviewDue = !reviewWritten && dayOfWeek(today) >= 5;

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

  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak) ?? null;
  const autopilotPct = Math.min(100, Math.round((streak / AUTOPILOT_DAYS) * 100));
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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      {/* One line, and the reasoning behind it if you tap. Steps to the next
          one each time the app is opened. */}
      <RotatingTip />

      {justCelebrated && (
        <View style={styles.celebration}>
          <Text style={styles.celebrationEmoji}>🔥</Text>
          <Text style={styles.celebrationText}>
            {justCelebrated} {plural(justCelebrated, ["день", "дня", "дней"])} подряд! По видео это{" "}
            {justCelebrated >= 66 ? "автопилот — привычка закрепилась" : "важная веха на пути к автопилоту"}.
          </Text>
        </View>
      )}

      {/* The number, how far it is between milestones, and what that stretch
          is called — one block instead of the milestone dots, the "N из M до
          вехи" line and the phase card that all said this separately. */}
      <StreakRing streak={streak} hasHistory={hasHistory} />

      <Text style={styles.sectionLabel}>Последние 4 недели</Text>
      <MonthGrid today={today} habits={habits} logs={streakLogs} />

      {/* Only while the ring is aimed at something nearer — once the next
          milestone IS 66 the two would be the same bar twice. */}
      {nextMilestone !== null && nextMilestone < AUTOPILOT_DAYS && (
        <View style={styles.autopilotCard}>
          <View style={styles.autopilotTrack}>
            <View style={[styles.autopilotFill, { width: `${autopilotPct}%` }]} />
          </View>
          <View style={styles.autopilotRow}>
            <Text style={styles.subtleSmall}>
              {streak} {plural(streak, ["день", "дня", "дней"])}
            </Text>
            <Text style={styles.subtleSmall}>{AUTOPILOT_DAYS} — привычка держится сама</Text>
          </View>
        </View>
      )}

      <View style={styles.sessionsCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sessionsValue}>{sessions.length}</Text>
          <Text style={styles.subtleSmall}>
            {plural(sessions.length, ["фокус-сессия", "фокус-сессии", "фокус-сессий"])} за неделю
          </Text>
        </View>
        <View style={styles.spark}>
          {days.map((d) => {
            const count = sessionsByDay(d);
            return (
              <View key={d} style={styles.sparkCol}>
                <View
                  style={[
                    styles.sparkBar,
                    { height: count ? Math.min(28, 8 + count * 8) : 5 },
                    count > 0 && { backgroundColor: colors.blue },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>

      {/* Prompted rather than hidden in settings — a review nobody is
          reminded of is a review nobody writes. */}
      <Pressable
        onPress={() => navigation.navigate("Review")}
        accessibilityRole="button"
        style={({ pressed }) => [styles.reviewRow, reviewDue && styles.reviewRowDue, pressed && { opacity: 0.7 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.reviewLabel, reviewDue && { color: colors.accent }]}>
            {reviewDue ? "Пора на сверку за неделю" : "Сверка за неделю"}
          </Text>
          <Text style={styles.reviewHint}>
            {reviewWritten
              ? "На этой неделе записана — можно дописать"
              : "Что работало, что нет, что меняешь. Раз в неделю, на холодную голову."}
          </Text>
        </View>
        <Text style={styles.reviewChevron}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionLabel: { color: colors.textMuted, fontSize: 12, marginTop: 22, marginBottom: 8 },
  subtleSmall: { color: colors.textMuted, fontSize: 11 },

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

  autopilotCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 10,
  },
  autopilotTrack: { height: 6, borderRadius: 3, backgroundColor: colors.cardBorder, overflow: "hidden" },
  autopilotFill: { height: "100%", borderRadius: 3, backgroundColor: colors.accentGreen },
  autopilotRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },

  sessionsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  sessionsValue: { color: colors.blue, fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  spark: { flexDirection: "row", alignItems: "flex-end", gap: 5, width: 96, height: 28 },
  sparkCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" },
  sparkBar: { width: "100%", borderRadius: 3, backgroundColor: colors.cardBorder },

  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  reviewRowDue: { borderWidth: 1, borderColor: colors.accent },
  reviewLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  reviewHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  reviewChevron: { color: colors.textMuted, fontSize: 20 },
});
