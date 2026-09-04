import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, DEFAULT_REPORT_PREFS, STREAK_MILESTONES, type ReportPrefs } from "../api/client";
import { colors } from "../theme/colors";
import { dateNDaysAgo } from "../lib/date";
import { plural } from "../lib/plural";
import { Feather } from "@expo/vector-icons";
import { habitStats } from "../lib/habitStats";
import { habitGroup } from "../lib/habits";
import { STREAK_WINDOW_DAYS } from "../lib/streak";
import { useStreak } from "../lib/useStreak";
import { useTodayKey } from "../lib/useTodayKey";
import { weekKey, dayOfWeek } from "../lib/week";
import RotatingTip from "../components/RotatingTip";
import StreakRing from "../components/StreakRing";
import PhaseBar from "../components/PhaseBar";
import HistoryCalendar from "../components/HistoryCalendar";
import type { Habit, HabitLog, FocusSession, WeeklyReview } from "../types";

export default function ReportScreen({
  navigation,
}: {
  navigation: { navigate: (screen: string, params?: Record<string, unknown>) => void };
}) {
  const qc = useQueryClient();
  // Re-renders when the local day turns over, so a report left open overnight
  // rolls onto the new week instead of freezing on yesterday.
  const today = useTodayKey();
  const weekStart = dateNDaysAgo(6);
  // One day wider than computeStreak walks, so the loop can never run off the end of what
  // was fetched. The Этапы screen builds the same key from the same constant, and shares
  // this cache entry rather than refetching four months of logs on open.
  const streakWindowStart = dateNDaysAgo(STREAK_WINDOW_DAYS);

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

  // Also where the weekly freeze is granted — see useStreak.
  const { streak, freezes } = useStreak(today);
  // "Потом" has nothing to report until it has been done at least once.
  const { data: reportPrefs = DEFAULT_REPORT_PREFS } = useQuery<ReportPrefs>({
    queryKey: ["reportPrefs"],
    queryFn: () => api.getReportPrefs(),
  });
  const saveReportPrefs = useMutation({
    mutationFn: (next: ReportPrefs) => api.setReportPrefs(next),
    onSuccess: (applied) => qc.setQueryData(["reportPrefs"], applied),
  });

  const reportable = habits.filter((h) => habitGroup(h) !== "later" || streakLogs.some((l) => l.habitId === h.id && l.done));
  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak) ?? null;
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
      {/* The calendar folds away inside the streak card: it is the same
          subject as the number above it, and it is not what the screen is
          opened for. */}
      <StreakRing streak={streak} hasHistory={hasHistory}>
        {(tint) => <HistoryCalendar today={today} habits={habits} accent={tint} frozen={freezes} />}
      </StreakRing>

      {/* The whole road with its stretches marked. Shown at every streak length: the ring
          measures from the previous milestone, so it can't say how far along the 66 days
          you are, and that is exactly what this is for. */}
      <PhaseBar streak={streak} onPress={() => navigation.navigate("Phases")} />

      {/* Each habit's own run, which the ring above cannot show: it answers "did the whole
          system hold today", so a habit added a week in inherits the whole streak. */}
      {reportable.length > 0 && (
        <>
          {/* Folds away like the calendar does: with eight habits the list is most of the
              screen, and the ring above it is what the report opens for. */}
          <Pressable
            onPress={() => saveReportPrefs.mutate({ ...reportPrefs, habitsOpen: !reportPrefs.habitsOpen })}
            accessibilityRole="button"
            accessibilityState={{ expanded: reportPrefs.habitsOpen }}
            accessibilityLabel="По привычкам"
            style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressedRow]}
          >
            <Text style={styles.sectionLabel}>По привычкам</Text>
            <View style={styles.sectionHeaderRight}>
              {!reportPrefs.habitsOpen && <Text style={styles.subtleSmall}>{reportable.length}</Text>}
              <Feather
                name={reportPrefs.habitsOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.textMuted}
              />
            </View>
          </Pressable>
          {reportPrefs.habitsOpen &&
            reportable.map((h) => {
            const stats = habitStats(h, streakLogs, today, freezes);
            return (
              <Pressable
                key={h.id}
                onPress={() => navigation.navigate("HabitReport", { habitId: h.id, title: h.label })}
                accessibilityRole="button"
                accessibilityLabel={`${h.label}: ${stats.streak}`}
                style={({ pressed }) => [styles.habitRow, pressed && styles.pressedRow]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.habitName} numberOfLines={1}>
                    {h.label}
                  </Text>
                  <Text style={styles.subtleSmall}>
                    {stats.streak > 0
                      ? stats.unit === "days"
                        ? `${stats.streak} ${plural(stats.streak, ["день", "дня", "дней"])} подряд`
                        : `${stats.streak} ${plural(stats.streak, ["неделя", "недели", "недель"])} подряд`
                      : "серии пока нет"}
                  </Text>
                </View>
                {/* Seven dots, oldest on the left — a week at a glance without opening it. */}
                <View style={styles.strip}>
                  {stats.week.map((done, i) => (
                    <View key={i} style={[styles.stripDot, done && styles.stripDotOn]} />
                  ))}
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </Pressable>
              );
            })}
        </>
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

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  pressedRow: { opacity: 0.75 },
  habitName: { color: colors.text, fontSize: 14, fontWeight: "500" },
  strip: { flexDirection: "row", gap: 4 },
  stripDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.cardBorder },
  stripDotOn: { backgroundColor: colors.accentGreen },
});
