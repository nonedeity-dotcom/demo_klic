import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, Modal, AppState, ScrollView, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, DEFAULT_FOCUS_INTERVALS, type FocusIntervals } from "../api/client";
import { colors } from "../theme/colors";
import TipCard from "../components/TipCard";
import { TIPS, rotationNumber } from "../content/library";
import { todayKey } from "../lib/date";
import { useFold } from "../lib/useFold";
import {
  FOCUS_PHASES,
  PHASE_CAPTIONS,
  PHASE_FIELDS,
  PHASE_LABELS,
  countsAsSession,
  nextPhase,
  phaseMinutes,
  type FocusPhase,
} from "../lib/focusPhases";
import {
  cancelChime,
  clearPhaseSound,
  getFocusSounds,
  pickPhaseSound,
  playPhaseChime,
  scheduleChime,
  stopChime,
  type FocusSounds,
} from "../notifications/chime";
import type { RewardOption } from "../types";

const SIZE = 220;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

// The ratios the source material and its usual variants use. Anything else is
// still reachable with the steppers. Boredom is not part of a preset: it is a fixed
// wind-down, not a ratio, and a preset that quietly retuned it would be a surprise.
const PRESETS: { workMin: number; breakMin: number }[] = [
  { workMin: 25, breakMin: 5 },
  { workMin: 50, breakMin: 10 },
  { workMin: 60, breakMin: 20 },
  { workMin: 90, breakMin: 20 },
];

/**
 * The sound tip, pulled from the reference by id. Content lives in library.ts and nowhere
 * else, so the wording here and in the Подсказки screen can never drift apart.
 */
const SOUND_TIP = TIPS.find((t) => t.id === "focus-sound")!;

export default function FocusScreen() {
  const qc = useQueryClient();
  // "work" rather than "boredom" on open: the wind-down is something you choose to do
  // before a session, and defaulting to it would make the first tap start the wrong clock.
  const [phase, setPhase] = useState<FocusPhase>("work");
  // The lengths are a saved setting now, not constants. Until the stored value
  // arrives the defaults stand in, and the idle timer is re-seeded from it —
  // see the effect below.
  const { data: intervals = DEFAULT_FOCUS_INTERVALS } = useQuery<FocusIntervals>({
    queryKey: ["focusIntervals"],
    queryFn: () => api.getFocusIntervals(),
  });
  const workMin = intervals.workMin;
  const breakMin = intervals.breakMin;

  const [editing, setEditing] = useState(false);
  const [soundTipOpen, setSoundTipOpen] = useState(false);
  const soundsFold = useFold();
  const [sounds, setSounds] = useState<FocusSounds>({});
  const [picking, setPicking] = useState<FocusPhase | null>(null);
  const [soundError, setSoundError] = useState<string | null>(null);
  /**
   * Whether the backup notification is actually armed for the phase now running.
   *
   * null while nothing runs. The screen says which of the two mechanisms is behind the
   * current session, because "it will ring with the phone away" and "it will ring only if
   * you are looking at it" are different promises.
   */
  const [alarmArmed, setAlarmArmed] = useState<boolean | null>(null);

  useEffect(() => {
    getFocusSounds().then(setSounds);
  }, []);
  const [draft, setDraft] = useState<FocusIntervals>(DEFAULT_FOCUS_INTERVALS);

  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_FOCUS_INTERVALS.workMin * 60);
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

  const saveIntervals = useMutation({
    mutationFn: (next: FocusIntervals) => api.setFocusIntervals(next),
    onSuccess: (applied) => {
      qc.setQueryData(["focusIntervals"], applied);
      setEditing(false);
    },
  });

  // True from the moment a phase is started until it ends or is reset. Pause
  // also sets `running` to false, so re-seeding on `!running` alone would wipe
  // a paused session the moment the stored lengths loaded.
  const startedRef = useRef(false);

  // An untouched timer should show the length that is actually saved —
  // including right after the stored value first loads, and right after it is
  // changed. A session in progress is left alone: silently retargeting it
  // would either cut it short or extend it without asking.
  useEffect(() => {
    if (running || startedRef.current) return;
    setSecondsLeft(phaseMinutes(intervals, phase) * 60);
  }, [intervals, phase, running]);

  // Guards against the phase flipping twice: the old code called this from
  // inside a setSecondsLeft updater, and React may run an updater more than
  // once — which logged the same focus session twice and reopened the modal.
  const endingRef = useRef(false);

  const handleSessionEnd = useCallback(() => {
    if (endingRef.current) return;
    endingRef.current = true;

    deadlineRef.current = null;
    setRunning(false);
    startedRef.current = false;
    setAlarmArmed(null);
    // We got here with the app open, so the notification armed for this deadline would only
    // be a duplicate of the chime about to play.
    void cancelChime();
    void playPhaseChime(phase);

    const next = nextPhase(phase);
    if (countsAsSession(phase)) {
      logSession.mutate(phaseMinutes(intervals, phase));
      setShowReward(true); // offline-progress step: pick a reward before the break starts
    }
    setPhase(next);
    setSecondsLeft(phaseMinutes(intervals, next) * 60);
    // Released on the next tick, once the state updates above are queued.
    setTimeout(() => {
      endingRef.current = false;
    }, 0);
  }, [phase, intervals, logSession]);

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

  const totalSecs = phaseMinutes(intervals, phase) * 60;
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
      setAlarmArmed(null);
      // Otherwise a paused timer still goes off at the original deadline.
      void cancelChime();
    } else {
      if (secondsLeft <= 0) return;
      const deadline = Date.now() + secondsLeft * 1000;
      deadlineRef.current = deadline;
      startedRef.current = true;
      setRunning(true);
      void stopChime();
      // Armed here rather than at the end, because at the end this app may not be running.
      scheduleChime(phase, deadline).then(setAlarmArmed);
    }
  };

  const resetTimer = () => {
    deadlineRef.current = null;
    setRunning(false);
    startedRef.current = false;
    setAlarmArmed(null);
    void cancelChime();
    void stopChime();
    setPhase("work");
    setSecondsLeft(phaseMinutes(intervals, "work") * 60);
    // A reward prompt left open from the session that just ended shouldn't
    // survive an explicit reset.
    setShowReward(false);
  };

  /**
   * Switching to another phase by hand. Whatever was running is dropped: three phases with
   * one clock means picking a different one is starting over, and silently keeping the old
   * countdown under a new label would be worse than either.
   */
  const selectPhase = (next: FocusPhase) => {
    if (next === phase && !startedRef.current) return;
    deadlineRef.current = null;
    setRunning(false);
    startedRef.current = false;
    setAlarmArmed(null);
    void cancelChime();
    void stopChime();
    setPhase(next);
    setSecondsLeft(phaseMinutes(intervals, next) * 60);
  };

  const choosePhaseSound = async (target: FocusPhase) => {
    setPicking(target);
    setSoundError(null);
    const res = await pickPhaseSound(target);
    if (res.status === "picked") setSounds((prev) => ({ ...prev, [target]: res.sound }));
    else if (res.status === "unplayable")
      setSoundError("Этот файл не удалось открыть. Попробуй другой — mp3, m4a, wav или ogg.");
    setPicking(null);
  };

  const resetPhaseSound = async (target: FocusPhase) => {
    await clearPhaseSound(target);
    setSounds((prev) => {
      const next = { ...prev };
      delete next[target];
      return next;
    });
  };

  const openEditor = () => {
    setDraft(intervals);
    setEditing(true);
  };
  const bumpDraft = (field: keyof FocusIntervals, delta: number) =>
    setDraft((d) => ({ ...d, [field]: Math.min(240, Math.max(1, d[field] + delta)) }));
  const draftUnchanged =
    draft.workMin === workMin && draft.breakMin === breakMin && draft.boredomMin === intervals.boredomMin;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.subtle}>{PHASE_CAPTIONS[phase]}</Text>

      {/* Three clocks, one ring. The row is the only way to reach boredom deliberately —
          the automatic hand-over never goes back to it. */}
      <View style={styles.phaseRow}>
        {FOCUS_PHASES.map((p) => {
          const active = p === phase;
          return (
            <Pressable
              key={p}
              onPress={() => selectPhase(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Фаза: ${PHASE_LABELS[p]}`}
              style={({ pressed }) => [styles.phaseChip, active && styles.phaseChipActive, pressed && styles.dimmed]}
            >
              <Text style={[styles.phaseChipText, active && styles.phaseChipTextActive]}>
                {PHASE_LABELS[p]}
              </Text>
              <Text style={[styles.phaseChipMin, active && styles.phaseChipMinActive]}>
                {phaseMinutes(intervals, p)} мин
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: 20 }} />
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
            <Text style={styles.timerLabel}>{PHASE_LABELS[phase]}</Text>
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

      {/* The OS's answer, not ours: a timer you trust enough to walk away from has to say
          whether it can actually reach you. */}
      {running && (
        <Text style={styles.footnote}>
          {alarmArmed === false
            ? "Прозвенит только пока приложение открыто — уведомления запрещены."
            : "Прозвенит и с закрытым приложением."}
        </Text>
      )}

      <Text style={styles.footnote}>
        {phase === "boredom"
          ? "Ничего не делай: без телефона, без музыки, без ленты. В этом весь смысл отрезка."
          : phase === "work"
            ? "Телефон — экраном вниз и подальше. Сигнал прозвенит сам."
            : "Во время перерыва — без телефона: прогулка, чай, свежий воздух."}
      </Text>

      {/* The lengths used to be constants in this file. Editing is folded away
          by default so the screen stays a timer rather than a settings page. */}
      {!editing ? (
        <Pressable
          onPress={openEditor}
          accessibilityRole="button"
          accessibilityLabel="Изменить длительность отрезков"
          style={({ pressed }) => [styles.intervalSummary, pressed && styles.dimmed]}
        >
          <Text style={styles.intervalSummaryText}>
            {intervals.boredomMin} · {workMin} · {breakMin} мин — скука, работа, перерыв
          </Text>
          <Feather name="edit-2" size={14} color={colors.textMuted} />
        </Pressable>
      ) : (
        <View style={styles.editorCard}>
          <Text style={styles.editorLabel}>Длительность</Text>

          <View style={styles.presetRow}>
            {PRESETS.map((p) => {
              const active = draft.workMin === p.workMin && draft.breakMin === p.breakMin;
              return (
                <Pressable
                  key={`${p.workMin}-${p.breakMin}`}
                  onPress={() => setDraft((d) => ({ ...d, ...p }))}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.preset, active && styles.presetActive, pressed && styles.dimmed]}
                >
                  <Text style={[styles.presetText, active && styles.presetTextActive]}>
                    {p.workMin}/{p.breakMin}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {([
            ["boredomMin", "Скука", 5],
            ["workMin", "Работа", 5],
            ["breakMin", "Перерыв", 5],
          ] as const).map(([field, label, step]) => (
            <View key={field} style={styles.editorRow}>
              <Text style={styles.editorRowLabel}>{label}</Text>
              <View style={styles.editorStepper}>
                <Pressable
                  onPress={() => bumpDraft(field, -step)}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}: минус ${step} минут`}
                  style={({ pressed }) => [styles.smallBtn, pressed && styles.dimmed]}
                >
                  <Text style={styles.smallBtnText}>−</Text>
                </Pressable>
                <Text style={styles.editorValue}>{draft[field]} мин</Text>
                <Pressable
                  onPress={() => bumpDraft(field, step)}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}: плюс ${step} минут`}
                  style={({ pressed }) => [styles.smallBtn, pressed && styles.dimmed]}
                >
                  <Text style={styles.smallBtnText}>+</Text>
                </Pressable>
              </View>
            </View>
          ))}

          {startedRef.current && !draftUnchanged && (
            <Text style={styles.editorNote}>
              Отрезок уже идёт — новая длительность применится со следующего.
            </Text>
          )}

          <View style={styles.editorButtons}>
            <Pressable
              onPress={() => setEditing(false)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.editorCancel, pressed && styles.dimmed]}
            >
              <Text style={styles.editorCancelText}>Отмена</Text>
            </Pressable>
            <Pressable
              onPress={() => saveIntervals.mutate(draft)}
              disabled={saveIntervals.isPending}
              accessibilityRole="button"
              style={({ pressed }) => [styles.editorSave, pressed && styles.dimmed]}
            >
              <Text style={styles.editorSaveText}>Сохранить</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Folded away like the durations: this is a settings block on a screen that is
          otherwise a clock. */}
      <Pressable
        onPress={soundsFold.toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: soundsFold.open }}
        accessibilityLabel="Звук сигнала"
        style={({ pressed }) => [styles.intervalSummary, pressed && styles.dimmed]}
      >
        <Text style={styles.intervalSummaryText}>Звук сигнала</Text>
        <Feather name={soundsFold.open ? "chevron-up" : "chevron-down"} size={14} color={colors.textMuted} />
      </Pressable>

      {soundsFold.open && (
        <View style={styles.editorCard}>
          {FOCUS_PHASES.map((p) => {
            const chosen = sounds[p];
            return (
              <View key={p} style={styles.soundRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.editorRowLabel}>
                    {PHASE_LABELS[p][0].toUpperCase()}
                    {PHASE_LABELS[p].slice(1)}
                  </Text>
                  <Text style={styles.soundName} numberOfLines={1}>
                    {picking === p ? "выбираешь…" : chosen ? chosen.name : "только вибрация"}
                  </Text>
                </View>
                {chosen && (
                  <Pressable
                    onPress={() => void playPhaseChime(p)}
                    accessibilityRole="button"
                    accessibilityLabel={`Прослушать: ${PHASE_LABELS[p]}`}
                    style={({ pressed }) => [styles.smallBtn, pressed && styles.dimmed]}
                  >
                    <Feather name="play" size={13} color={colors.textMuted} />
                  </Pressable>
                )}
                <Pressable
                  onPress={() => void choosePhaseSound(p)}
                  disabled={picking !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Выбрать звук: ${PHASE_LABELS[p]}`}
                  style={({ pressed }) => [styles.smallBtn, pressed && styles.dimmed]}
                >
                  <Feather name="folder" size={13} color={colors.textMuted} />
                </Pressable>
                {chosen && (
                  <Pressable
                    onPress={() => void resetPhaseSound(p)}
                    accessibilityRole="button"
                    accessibilityLabel={`Убрать звук: ${PHASE_LABELS[p]}`}
                    style={({ pressed }) => [styles.smallBtn, pressed && styles.dimmed]}
                  >
                    <Feather name="x" size={13} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            );
          })}

          {soundError && <Text style={styles.soundError}>{soundError}</Text>}

          {/* Said plainly rather than discovered later: the file you pick is played by this
              app, and only this app can play it. */}
          <Text style={styles.editorNote}>
            Свой файл звучит, пока приложение открыто. Если телефон заблокирован или ты вышел
            из приложения, звонит уведомление — у него системный звук, его файлом не заменить.
            Вибрация работает в обоих случаях.
          </Text>
        </View>
      )}

      {/* The one piece of the source that belongs on this screen rather than only in the
          reference: what to have playing, and what not to have playing before you start.
          Rendered through TipCard so it reads and behaves like every other tip. */}
      <View style={styles.tipSlot}>
        <TipCard
          tip={SOUND_TIP}
          expanded={soundTipOpen}
          onToggle={() => setSoundTipOpen((v) => !v)}
          number={rotationNumber(SOUND_TIP.id)}
        />
      </View>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  phaseRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  phaseChip: {
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  phaseChipActive: { backgroundColor: "rgba(224,138,85,0.14)" },
  phaseChipText: { color: colors.textMuted, fontSize: 12 },
  phaseChipTextActive: { color: colors.accent },
  phaseChipMin: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  phaseChipMinActive: { color: colors.accent },
  soundRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  soundName: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  soundError: { color: colors.accent, fontSize: 11, marginTop: 6, lineHeight: 16 },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { alignItems: "center", paddingTop: 40, paddingHorizontal: 24, paddingBottom: 40 },
  // The tip is the one full-width thing on a screen that centres everything else.
  tipSlot: { alignSelf: "stretch", marginTop: 28 },
  subtle: { color: colors.textMuted, fontSize: 13 },
  timerText: { color: colors.text, fontSize: 40, fontWeight: "700", fontVariant: ["tabular-nums"] },
  timerLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 },
  primaryBtn: { backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  primaryBtnText: { color: colors.bg, fontWeight: "600", fontSize: 14 },
  secondaryBtn: { backgroundColor: colors.card, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  secondaryBtnText: { color: colors.textMuted, fontWeight: "600", fontSize: 14 },
  footnote: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 24, maxWidth: 260 },
  dimmed: { opacity: 0.65 },

  intervalSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
  intervalSummaryText: { color: colors.textMuted, fontSize: 12 },
  editorCard: {
    alignSelf: "stretch",
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 24,
    gap: 12,
  },
  editorLabel: { color: colors.textMuted, fontSize: 12 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  presetActive: { backgroundColor: "rgba(143,184,154,0.12)", borderColor: colors.accentGreen },
  presetText: { color: colors.textMuted, fontSize: 13, fontVariant: ["tabular-nums"] },
  presetTextActive: { color: colors.accentGreen, fontWeight: "600" },
  editorRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editorRowLabel: { color: colors.text, fontSize: 14 },
  editorStepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  smallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnText: { color: colors.text, fontSize: 17, fontWeight: "600" },
  editorValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    minWidth: 60,
    textAlign: "center",
  },
  editorNote: { color: colors.accent, fontSize: 11, lineHeight: 16 },
  editorButtons: { flexDirection: "row", gap: 10, marginTop: 2 },
  editorCancel: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  editorCancelText: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
  editorSave: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center", backgroundColor: colors.accent },
  editorSaveText: { color: colors.bg, fontSize: 13, fontWeight: "600" },

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
