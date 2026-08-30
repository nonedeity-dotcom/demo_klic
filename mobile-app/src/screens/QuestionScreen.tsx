import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import type { DailyQuestion } from "../types";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function dateNDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function QuestionScreen() {
  const qc = useQueryClient();
  const today = todayKey();
  const [draft, setDraft] = useState("");

  const from = dateNDaysAgo(6);
  const { data: history = [] } = useQuery<DailyQuestion[]>({
    queryKey: ["question", from, today],
    queryFn: () => api.getQuestion(from, today) as Promise<DailyQuestion[]>,
  });

  useEffect(() => {
    const todays = history.find((q) => q.date === today);
    if (todays) setDraft(todays.text);
  }, [history, today]);

  const save = useMutation({
    mutationFn: (text: string) => api.setQuestion(today, text),
    onSettled: () => qc.invalidateQueries({ queryKey: ["question"] }),
  });

  const past = history.filter((q) => q.date !== today);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Что одно я могу убрать сегодня?</Text>
      <Text style={styles.subtle}>одна привычка, одно приложение, один триггер, одно утреннее действие</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={() => save.mutate(draft)}
        placeholder="Сегодня уберу…"
        placeholderTextColor="#5a5f68"
        multiline
        style={styles.input}
      />
      <Pressable onPress={() => save.mutate(draft)} style={styles.saveBtn}>
        <Text style={styles.saveBtnText}>Сохранить</Text>
      </Pressable>

      {past.length > 0 && (
        <View style={{ marginTop: 28 }}>
          <Text style={styles.sectionLabel}>Прошлые ответы</Text>
          {past.map((q) => (
            <View key={q.date} style={styles.historyItem}>
              <Text style={styles.historyDate}>{q.date}</Text>
              <Text style={styles.historyText}>{q.text}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 4 },
  subtle: { color: colors.textMuted, fontSize: 12, marginBottom: 16 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    color: colors.text,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  saveBtn: { marginTop: 12, backgroundColor: colors.accent, alignSelf: "flex-start", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  saveBtnText: { color: colors.bg, fontWeight: "600", fontSize: 14 },
  sectionLabel: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 },
  historyItem: { backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  historyDate: { color: colors.textMuted, fontSize: 10, marginBottom: 2 },
  historyText: { color: colors.text, fontSize: 13 },
});
