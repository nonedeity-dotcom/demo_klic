import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, Modal, AppState, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { colors } from "../theme/colors";
import { todayKey } from "../lib/date";
import type { RewardOption } from "../types";

const WORK_MIN = 50;
const BREAK_MIN = 10;
const SIZE = 220;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export default function FocusScreen() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"work" | "break">("work");
  const workMin = WORK_MIN;
  const breakMin = BREAK_MIN;
  const [secondsLeft, setSecondsLeft] = useState(WORK_MIN * 60);
  const [running, setRunning] = useState(false);
  // The timer is driven by a wall-clock deadline, not by counting ticks.
  // setInterval only fires while JS is running, so the old version froze the
  // moment the screen locked or the app went to the background — in an app
  // whose whole advice is "put the phone in another room", the 50 minutes
  // never actually elapsed. Now the interval only *renders* the remaining
  // time; the truth is `deadlineRef` vs. Date.now().
  const deadlineRef = useRef<number | null>(null);
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
    mutationFn: (durationMin: number) => api.addSession(todayKey(), durationMin),
    // The report screen reads ["sessions", "week"]; without invalidating, a
    // finished session didn't show up there until the cache happened to expire.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }),
  });
  const logReward = useMutation({
    mutationFn: (text: string) => api.addReward(todayKey(), text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rewards"] }),
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

  // Guards against the phase flipping twice: the old code called this from
  // inside a setSecondsLeft updater, and React may run an updater more than
  // once — which logged the same focus session twice and reopened the modal.
  const endingRef = useRef(false);

  const handleSessionEnd = useCallback(() => {
    if (endingRef.current) return;
    endingRef.current = true;

    deadlineRef.current = null;
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
    // Released on the next tick, once the state updates above are queued.
    setTimeout(() => {
      endingRef.current = false;
    }, 0);
  }, [mode, workMin, breakMin, logSession]);

  // Read through a ref so the ticking effect below depends only on `running`.
  // Depending on the callback itself would tear down and rebuild the interval
  // on every single re-render — i.e. twice a second while the timer runs.
  const endRef = useRef(handleSessionEnd);
  useEffect(() => {
    endRef.current = handleSessionEnd;
  }, [handleSessionEnd]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    // Recompute from the deadline rather than decrementing, so time that
    // passed while the app was backgrounded is accounted for.
    const tick = () => {
      const deadline = deadlineRef.current;
      if (deadline == null) return;
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) endRef.current();
    };

    intervalRef.current = setInterval(tick, 500);
    // Catch up immediately on resume instead of waiting for the next tick.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      sub.remove();
    };
  }, [running]);

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

  const toggleRunning = () => {
    if (running) {
      // Pause: freeze at whatever the deadline says right now.
      const deadline = deadlineRef.current;
      if (deadline != null) setSecondsLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
      deadlineRef.current = null;
      setRunning(false);
    } else {
      if (secondsLeft <= 0) return;
      deadlineRef.current = Date.now() + secondsLeft * 1000;
      setRunning(true);
    }
  };

  const resetTimer = () => {
    deadlineRef.current = null;
    setRunning(false);
    setMode("work");
    setSecondsLeft(workMin * 60);
    // A reward prompt left open from the session that just ended shouldn't
    // survive an explicit reset.
    setShowReward(false);
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
        <Pressable onPress={toggleRunning} style={styles.primaryBtn}>
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
