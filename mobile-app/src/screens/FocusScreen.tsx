import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, Modal, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import type { RewardOption } from "../types";

const WORK_MIN = 50;
const BREAK_MIN = 10;
const SIZE = 220;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function FocusScreen() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"work" | "break">("work");
  const [workMin, setWorkMin] = useState(WORK_MIN);
  const [breakMin, setBreakMin] = useState(BREAK_MIN);
  const [secondsLeft, setSecondsLeft] = useState(WORK_MIN * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showReward, setShowReward] = useState(false);
  const [editingRewards, setEditingRewards] = useState(false);
  const [customReward, setCustomReward] = useState("");
  const [newOptionLabel, setNewOptionLabel] = useState("");

  const { data: rewardOptions = [] } = useQuery<RewardOption[]>({
    queryKey: ["rewardOptions"],
    queryFn: () => api.getRewardOptions() as Promise<RewardOption[]>,
  });
  const invalidateOptions = () => qc.invalidateQueries({ queryKey: ["rewardOptions"] });

  const logSession = useMutation({
    mutationFn: (durationMin: number) =>
      api.addSession(new Date().toISOString().slice(0, 10), durationMin),
  });
  const logReward = useMutation({
    mutationFn: (text: string) => api.addReward(todayKey(), text),
  });
  const addOption = useMutation({
    mutationFn: (label: string) => api.addRewardOption(label),
    onSuccess: () => {
      setNewOptionLabel("");
      invalidateOptions();
    },
  });
  const removeOption = useMutation({
    mutationFn: (id: string) => api.removeRewardOption(id),
    onSuccess: invalidateOptions,
  });

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current!);
            handleSessionEnd();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function handleSessionEnd() {
    setRunning(false);
    if (mode === "work") {
      logSession.mutate(workMin);
      setMode("break");
      setSecondsLeft(breakMin * 60);
      setShowReward(true); // offline-progress step: pick a reward before the break starts
    } else {
      setMode("work");
      setSecondsLeft(workMin * 60);
    }
  }

  function pickReward(text: string) {
    if (!text.trim()) return;
    logReward.mutate(text.trim());
    setCustomReward("");
    setShowReward(false);
  }

  const totalSecs = mode === "work" ? workMin * 60 : breakMin * 60;
  const pct = 1 - secondsLeft / totalSecs;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const resetTimer = () => {
    setRunning(false);
    setMode("work");
    setSecondsLeft(workMin * 60);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.subtle}>{mode === "work" ? "Погружение" : "Офлайн-прогресс"}</Text>
      <View style={{ height: 24 }} />
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE} style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={colors.cardBorder} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.accent}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={CIRC * (1 - pct)}
          />
        </Svg>
        <View style={StyleSheet.absoluteFillObject}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={styles.timerText}>
              {mm}:{ss}
            </Text>
            <Text style={styles.timerLabel}>{mode === "work" ? "работа" : "перерыв"}</Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 28 }}>
        <Pressable onPress={() => setRunning((r) => !r)} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>
            {running ? "Пауза" : secondsLeft === totalSecs ? "Старт" : "Продолжить"}
          </Text>
        </Pressable>
        <Pressable onPress={resetTimer} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Сброс</Text>
        </Pressable>
      </View>

      <Text style={styles.footnote}>Во время перерыва — без телефона: прогулка, чай, свежий воздух.</Text>

      <Modal visible={showReward} transparent animationType="fade" onRequestClose={() => setShowReward(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Чем себя наградишь?</Text>
              <Pressable onPress={() => setEditingRewards((e) => !e)} accessibilityLabel="Настроить варианты наград">
                <Feather name="settings" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              полезное вознаграждение закрывает цикл — мозг связывает работу не с наказанием
            </Text>

            <View style={styles.chipRow}>
              {rewardOptions.map((o) => (
                <View key={o.id} style={styles.chipWrap}>
                  <Pressable
                    onPress={() => !editingRewards && pickReward(o.label)}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>{o.label}</Text>
                  </Pressable>
                  {editingRewards && (
                    <Pressable
                      onPress={() => removeOption.mutate(o.id)}
                      style={styles.chipRemove}
                      accessibilityLabel={`Удалить вариант: ${o.label}`}
                    >
                      <Feather name="x" size={11} color={colors.bg} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>

            {editingRewards && (
              <View style={styles.addOptionRow}>
                <TextInput
                  value={newOptionLabel}
                  onChangeText={setNewOptionLabel}
                  placeholder="Свой вариант…"
                  placeholderTextColor={colors.textMuted}
                  style={styles.addOptionInput}
                  onSubmitEditing={() => newOptionLabel.trim() && addOption.mutate(newOptionLabel.trim())}
                />
                <Pressable
                  onPress={() => newOptionLabel.trim() && addOption.mutate(newOptionLabel.trim())}
                  style={styles.iconBtn}
                >
                  <Feather name="plus" size={16} color={colors.accentGreen} />
                </Pressable>
              </View>
            )}

            <View style={styles.customRow}>
              <TextInput
                value={customReward}
                onChangeText={setCustomReward}
                placeholder="…или напиши, чем наградишься"
                placeholderTextColor={colors.textMuted}
                style={styles.customInput}
                onSubmitEditing={() => pickReward(customReward)}
              />
              <Pressable onPress={() => pickReward(customReward)} style={styles.iconBtn}>
                <Feather name="check" size={16} color={colors.accentGreen} />
              </Pressable>
            </View>

            <Pressable onPress={() => setShowReward(false)}>
              <Text style={styles.skipText}>Пропустить</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
  subtle: { color: colors.textMuted, fontSize: 13 },
  timerText: { color: colors.text, fontSize: 40, fontWeight: "700", fontVariant: ["tabular-nums"] },
  timerLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 },
  primaryBtn: { backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  primaryBtnText: { color: colors.bg, fontWeight: "600", fontSize: 14 },
  secondaryBtn: { backgroundColor: colors.card, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  secondaryBtnText: { color: colors.textMuted, fontWeight: "600", fontSize: 14 },
  footnote: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 24, maxWidth: 260 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: colors.card, borderRadius: 20, padding: 20 },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  modalSubtitle: { color: colors.textMuted, fontSize: 11, marginTop: 6, marginBottom: 18, lineHeight: 15 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipWrap: { position: "relative" },
  chip: {
    backgroundColor: colors.bg,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipText: { color: colors.text, fontSize: 13 },
  chipRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  addOptionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  addOptionInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  customRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  customInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  iconBtn: { padding: 6 },
  skipText: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 18 },
});
