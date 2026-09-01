import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import { formatDateShort } from "../lib/date";
import { useTodayKey } from "../lib/useTodayKey";
import { weekKey, weekStart } from "../lib/week";
import type { WeeklyReview } from "../types";

const FIELDS = [
  { key: "worked", label: "Что работало", placeholder: "что шло само, без уговоров…" },
  { key: "didnt", label: "Что не работало", placeholder: "где каждый раз спотыкался…" },
  { key: "change", label: "Что меняю", placeholder: "одно изменение на следующую неделю…" },
] as const;

/**
 * Step 5 of the "точка возврата" protocol: once a week, on a calm head, look
 * at what worked and change one thing.
 *
 * Deliberately weekly and deliberately not a daily prompt — the source's
 * other half is that decisions taken on a bad day are almost always "stop",
 * so this is the place they are meant to wait for.
 */
export default function ReviewScreen() {
  const qc = useQueryClient();
  const today = useTodayKey();
  const week = weekKey(today);

  const { data: reviews = [] } = useQuery<WeeklyReview[]>({
    queryKey: ["reviews"],
    queryFn: () => api.getReviews(),
  });

  const [draft, setDraft] = useState({ worked: "", didnt: "", change: "" });
  // Load this week's saved answers once, not on every refetch: re-seeding the
  // fields after each invalidation would wipe whatever is being typed.
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (loadedFor.current === week) return;
    const existing = reviews.find((r) => r.week === week);
    if (existing) {
      setDraft({ worked: existing.worked, didnt: existing.didnt, change: existing.change });
      loadedFor.current = week;
    } else if (reviews.length > 0 || loadedFor.current === null) {
      loadedFor.current = week;
    }
  }, [week, reviews]);

  const save = useMutation({
    mutationFn: () => api.saveReview({ week, date: today, ...draft }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });

  const empty = !draft.worked.trim() && !draft.didnt.trim() && !draft.change.trim();
  const past = reviews.filter((r) => r.week !== week);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.intro}>
        Раз в неделю, на холодную голову. И правило оттуда же: в плохой день решения не принимаются —
        они ждут этого экрана.
      </Text>

      <Text style={styles.weekLabel}>Неделя с {formatDateShort(weekStart(today))}</Text>

      {FIELDS.map((f) => (
        <View key={f.key} style={styles.field}>
          <Text style={styles.fieldLabel}>{f.label}</Text>
          <TextInput
            value={draft[f.key]}
            onChangeText={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
            placeholder={f.placeholder}
            placeholderTextColor={colors.textMuted}
            multiline
            style={styles.input}
            accessibilityLabel={f.label}
          />
        </View>
      ))}

      <Pressable
        onPress={() => save.mutate()}
        disabled={empty || save.isPending}
        accessibilityRole="button"
        style={({ pressed }) => [styles.saveBtn, (empty || pressed) && styles.dimmed]}
      >
        <Text style={styles.saveBtnText}>{save.isSuccess && !save.isPending ? "Сохранено" : "Сохранить"}</Text>
      </Pressable>

      {past.length > 0 && (
        <>
          <Text style={styles.historyLabel}>Прошлые сверки</Text>
          {past.map((r) => (
            <View key={r.week} style={styles.historyCard}>
              <Text style={styles.historyDate}>{formatDateShort(r.date)}</Text>
              {r.worked ? <Text style={styles.historyLine}>Работало: {r.worked}</Text> : null}
              {r.didnt ? <Text style={styles.historyLine}>Не работало: {r.didnt}</Text> : null}
              {r.change ? <Text style={styles.historyChange}>Менял: {r.change}</Text> : null}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  intro: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 18 },
  weekLabel: { color: colors.text, fontSize: 14, fontWeight: "600", marginBottom: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  input: {
    color: colors.text,
    fontSize: 14,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 70,
    textAlignVertical: "top",
  },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: colors.bg, fontSize: 14, fontWeight: "600" },
  dimmed: { opacity: 0.5 },
  historyLabel: { color: colors.textMuted, fontSize: 12, marginTop: 28, marginBottom: 10 },
  historyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    gap: 6,
  },
  historyDate: { color: colors.textMuted, fontSize: 11 },
  historyLine: { color: colors.text, fontSize: 13, lineHeight: 18 },
  historyChange: { color: colors.accentGreen, fontSize: 13, lineHeight: 18 },
});
