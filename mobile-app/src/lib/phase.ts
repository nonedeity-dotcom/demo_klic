/**
 * Which phase of a new habit you are in — honeymoon, the dip, or plateau.
 *
 * From the "why people quit halfway" source: almost everyone quits in the
 * dip, and they quit because they read "this is hard now" as "this isn't for
 * me" rather than as a phase. A streak number alone doesn't say that; it just
 * counts. This is what turns the count into something you can act on.
 *
 * The day boundaries are an estimate. The source names the three phases and
 * says the first two weeks are the hardest, with 66 days as the point where
 * it runs on its own — it never gives exact cut-offs, and the copy below
 * doesn't pretend otherwise.
 */
export type PhaseId = "broken" | "honeymoon" | "dip" | "plateau";

export interface Phase {
  id: PhaseId;
  title: string;
  body: string;
  /** "warm" = attention, "steady" = it's holding. */
  tone: "warm" | "steady";
}

export function phaseFor(streak: number): Phase {
  if (streak <= 0) {
    return {
      id: "broken",
      title: "Цепочка прервана",
      body: "Начать заново — не то же самое, что начать сначала. Сделай минимальный вариант сегодня, этого достаточно, чтобы серия пошла снова.",
      tone: "warm",
    };
  }
  if (streak <= 3) {
    return {
      id: "honeymoon",
      title: "Медовый месяц",
      body: "Пока легко, и это ничего не говорит о том, что будет дальше — на этой фазе больше мечтается о результате, чем делается. Настоящая проверка начнётся, когда интерес спадёт.",
      tone: "warm",
    };
  }
  if (streak <= 21) {
    return {
      id: "dip",
      title: "Яма",
      body: "Самая тяжёлая фаза, и именно здесь бросают. Если сейчас не хочется и кажется, что это не твоё, — это про фазу, а не про тебя. Первые две недели самые трудные, дальше заметно легче.",
      tone: "warm",
    };
  }
  return {
    id: "plateau",
    title: "Плато",
    body:
      streak >= 66
        ? "66 дней — по этой схеме привычка закрепилась и идёт почти сама. Дальше её проще не ломать, чем поддерживать."
        : "Худшее позади: действие уже не требует прежнего усилия. Ориентир — 66 дней, после них оно обычно держится само.",
    tone: "steady",
  };
}

/** Rough day boundaries, shown so the numbers aren't presented as exact. */
export const PHASE_RANGE: Record<PhaseId, string> = {
  broken: "",
  honeymoon: "примерно 1–3 день",
  dip: "примерно 4–21 день",
  plateau: "примерно с 22 дня",
};
