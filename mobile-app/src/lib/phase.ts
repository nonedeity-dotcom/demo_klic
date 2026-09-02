/**
 * The four stretches a new habit goes through — honeymoon, the dip, plateau, autopilot.
 *
 * From the "why people quit halfway" source: almost everyone quits in the dip, and they
 * quit because they read "this is hard now" as "this isn't for me" rather than as a
 * stretch that ends. A streak number alone doesn't say that; it just counts. This is what
 * turns the count into something you can act on.
 *
 * The day boundaries are an estimate. The source names the stretches and says the first
 * two weeks are the hardest, with 66 days as the point where it runs on its own — it never
 * gives exact cut-offs, and the copy below doesn't pretend otherwise ("примерно").
 */
export type PhaseId = "honeymoon" | "dip" | "plateau" | "autopilot";

export interface PhaseStep {
  id: PhaseId;
  title: string;
  /** First day of the stretch. */
  fromDay: number;
  /** Last day, or null for the open-ended one at the end. */
  toDay: number | null;
  /** Hedged day range, shown so the numbers aren't presented as exact. */
  range: string;
  /** One line for the bar and the list. */
  short: string;
  /** The paragraph, on the Этапы screen. */
  body: string;
}

export const PHASE_STEPS: PhaseStep[] = [
  {
    id: "honeymoon",
    title: "Медовый месяц",
    fromDay: 1,
    toDay: 3,
    range: "примерно 1–3 день",
    short: "Пока легко — и это ещё ничего не значит",
    body: "Пока легко, и это ничего не говорит о том, что будет дальше — на этой фазе больше мечтается о результате, чем делается. Настоящая проверка начнётся, когда интерес спадёт.",
  },
  {
    id: "dip",
    title: "Яма",
    fromDay: 4,
    toDay: 21,
    range: "примерно 4–21 день",
    short: "Самая тяжёлая фаза, здесь бросают",
    body: "Самая тяжёлая фаза, и именно здесь бросают. Если сейчас не хочется и кажется, что это не твоё, — это про фазу, а не про тебя. Первые две недели самые трудные, дальше заметно легче.",
  },
  {
    id: "plateau",
    title: "Плато",
    fromDay: 22,
    toDay: 65,
    range: "примерно с 22 дня",
    short: "Худшее позади, усилий нужно меньше",
    body: "Худшее позади: действие уже не требует прежнего усилия. Ориентир — 66 дней, после них оно обычно держится само.",
  },
  {
    id: "autopilot",
    title: "Автопилот",
    fromDay: 66,
    toDay: null,
    range: "с 66 дня",
    short: "Привычка держится сама",
    body: "66 дней — по этой схеме привычка закрепилась и идёт почти сама. Дальше её проще не ломать, чем поддерживать.",
  },
];

/**
 * The stretch a streak of this length is in, or null when there is no streak at all —
 * day 0 isn't a phase, it's the absence of one, and the report says its own thing there.
 */
export function phaseStepFor(streak: number): PhaseStep | null {
  if (streak <= 0) return null;
  return PHASE_STEPS.find((s) => s.toDay === null || streak <= s.toDay) ?? null;
}

/**
 * The day the habit is held to run by itself — the far end of the progress bar. This is
 * also the last entry of STREAK_MILESTONES in api/client.ts: the ring's final milestone and
 * the end of the road are deliberately the same day, and moving one without the other would
 * leave the bar full while the ring still counted towards something.
 */
export const AUTOPILOT_DAY: number = PHASE_STEPS[PHASE_STEPS.length - 1].fromDay;

/**
 * The days the progress bar marks with a dot: where each stretch ends, plus the autopilot
 * day itself, which is also the end of the bar.
 *
 * Plateau's own last day (65) is dropped by the gap rule below — at bar scale it would sit
 * a pixel from 66 and read as a smudge rather than as two marks.
 */
const MIN_MARK_GAP_DAYS = 3;
export const PHASE_MARKS: number[] = [
  ...PHASE_STEPS.slice(0, -1)
    .map((s) => s.toDay as number)
    .filter((day) => AUTOPILOT_DAY - day > MIN_MARK_GAP_DAYS),
  AUTOPILOT_DAY,
];

/**
 * What to say when there is no streak to place. A fresh install and a chain you just broke
 * are not the same thing, and "начать заново" is a strange thing to say to someone who
 * never started.
 */
export function emptyNotice(hasHistory: boolean): { title: string; body: string } {
  return hasHistory
    ? {
        title: "Цепочка прервана",
        body: "Начать заново — не то же самое, что начать сначала. Сделай минимальный вариант сегодня, этого достаточно, чтобы серия пошла снова.",
      }
    : {
        title: "Пока пусто",
        body: "Отметь первую привычку — здесь появится цепочка дней и то, на каком ты этапе.",
      };
}
