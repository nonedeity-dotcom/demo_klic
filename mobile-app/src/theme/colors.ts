import type { PhaseId } from "../lib/phase";

// Same palette as the original web demo's Tailwind arbitrary values,
// centralized here since React Native has no CSS classes to grep for colors.
export const colors = {
  bg: "#12151a",
  card: "#1c2028",
  cardBorder: "#262b34",
  text: "#e8e6e0",
  textMuted: "#8b8f98",
  accent: "#e08a55", // spike / warm
  accentGreen: "#8fb89a", // steady / natural
  accentGreenDark: "#6f9f7f",
  blue: "#5c8fd6",
};

/**
 * One colour per stretch of the 66-day road.
 *
 * The rest of the app runs on two hues on purpose — warm means attention, green means it's
 * holding. These four are the deliberate exception: the stretches are the one place where
 * the point *is* that they differ from each other, and a person should recognise which one
 * they're in before reading a word. Nothing outside the streak card, the bar and the Этапы
 * screen uses them; in particular the calendar keeps green for "done", because that means
 * the same thing in every stretch.
 *
 * Each is at least 5:1 against `bg`, so the 11px range line under a title stays readable —
 * the purple is lightened from the mockup's own value for exactly that reason.
 */
export const phaseColors: Record<PhaseId, string> = {
  honeymoon: "#8cc888",
  dip: "#e06874",
  plateau: "#f4a858",
  autopilot: "#a97ae0",
};

/**
 * A hex colour at partial opacity, for the tinted card fills and borders.
 * React Native has no `color-mix()`, and rgba() strings are the only way to say
 * "this colour, quieter" without hand-picking a second hex for every phase.
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
