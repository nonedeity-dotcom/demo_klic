import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { api } from "../api/client";
import { ROTATION } from "../content/library";
import type { Tip } from "../content/library";

// The counter must move once per "opening the app", and a launch and a return
// from the background are both that. Advancing on mount alone isn't enough:
// Android usually keeps the process alive, so tapping the icon again often
// doesn't re-run any of this — the tip would look stuck. This module-level
// flag makes the mount step fire once per JS session rather than once per
// mount, so a remount (a data import invalidating queries, say) doesn't skip
// a tip.
let advancedThisSession = false;

export interface RotatingTip {
  tip: Tip;
  /** 1-based, for display: "Подсказка 7 из 39". */
  number: number;
  total: number;
}

export function useRotatingTip(): RotatingTip | null {
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const show = (i: number) => {
      if (alive) setIndex(i);
    };

    (advancedThisSession ? api.getTipCursor() : api.advanceTipCursor(ROTATION.length)).then(show);
    advancedThisSession = true;

    let previous = AppState.currentState;
    const sub = AppState.addEventListener("change", (state) => {
      // Only background -> active counts as reopening. A notification shade,
      // a permission dialog or the app switcher produce inactive -> active,
      // and burning a tip on those would make the number jump for no reason
      // the user can see.
      if (previous === "background" && state === "active") {
        api.advanceTipCursor(ROTATION.length).then(show);
      }
      previous = state;
    });

    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  if (index === null || ROTATION.length === 0) return null;
  const safe = ((index % ROTATION.length) + ROTATION.length) % ROTATION.length;
  return { tip: ROTATION[safe], number: safe + 1, total: ROTATION.length };
}
