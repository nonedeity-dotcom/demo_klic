import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api/client";
import { colors } from "../theme/colors";

const WORK_MIN = 50;
const BREAK_MIN = 10;
const SIZE = 220;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export default function FocusScreen() {
  const [mode, setMode] = useState<"work" | "break">("work");
  const [workMin, setWorkMin] = useState(WORK_MIN);
  const [breakMin, setBreakMin] = useState(BREAK_MIN);
  const [secondsLeft, setSecondsLeft] = useState(WORK_MIN * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const logSession = useMutation({
    mutationFn: (durationMin: number) =>
      api.addSession(new Date().toISOString().slice(0, 10), durationMin),
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
      logSession.mutate(workMin); // record on the server, not local storage
      setMode("break");
      setSecondsLeft(breakMin * 60);
    } else {
      setMode("work");
      setSecondsLeft(workMin * 60);
    }
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
});
