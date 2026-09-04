import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

/**
 * A fold-out that never remembers being open.
 *
 * The calendar and the per-habit list used to store "open" as a preference, so one tap left
 * them unfolded for good: you came back to the report and got a screen full of detail
 * instead of the one number it exists for. Opening a section is an act, not a setting — it
 * lasts while you are looking at it and closes when you leave the screen.
 *
 * Closing happens on blur rather than on focus, so nothing flickers open-then-shut on the
 * way in, and a fresh launch starts closed because the state starts closed.
 */
export function useFold(): { open: boolean; toggle: () => void } {
  const [open, setOpen] = useState(false);

  useFocusEffect(
    useCallback(() => () => setOpen(false), []),
  );

  return { open, toggle: useCallback(() => setOpen((v) => !v), []) };
}
