---
name: no-burnout-design
description: Design conventions for the no-burnout habit/focus tracker app (mobile-app/). Use when adding or changing any screen, component, or visual element in mobile-app/src — new screens, mockups, icons, or reviewing a UI change for consistency with the rest of the app.
---

# No Burnout — design conventions

This is a personal habit/focus tracker (React Native + Expo), themed around the
"less noise, more stability" idea from the app's source material (focus-cycle
and dopamine-detox notes). Dark, calm, low-stimulation UI — the design should
not fight that premise with bright colors, motion, or clutter.

## Palette

Source of truth: `mobile-app/src/theme/colors.ts`. Always import from there —
never hardcode hex values in a screen.

| Token | Value | Use |
|---|---|---|
| `bg` | `#12151a` | screen background |
| `card` | `#1c2028` | cards, inputs, inactive controls |
| `cardBorder` | `#262b34` | borders, track colors |
| `text` | `#e8e6e0` | primary text |
| `textMuted` | `#8b8f98` | secondary/hint text |
| `accent` | `#e08a55` | warm accent — "spike", timers, primary actions |
| `accentGreen` / `accentGreenDark` | `#8fb89a` / `#6f9f7f` | "steady/done" state — completed habits, removed triggers |
| `blue` | `#5c8fd6` | focus-session stats only |

Rule of thumb: warm accent (`accent`) = action/attention, green = completion/
calm, never introduce a new hue without a reason tied to meaning (like blue is
reserved for focus-session data).

## Screen inventory (`mobile-app/src/screens/`)

Six-tab bottom nav (`src/navigation/RootTabs.tsx`) plus a reminder tab:

1. **TodayScreen** — habit checklist for today
2. **FocusScreen** — 50/10 focus timer (SVG ring)
3. **EnergyScreen** — hourly energy grid (1-10 self-rating)
4. **TriggersScreen** — distraction triggers removed so far
5. **QuestionScreen** — "what can I remove today" daily prompt + history
6. **ReportScreen** — 7-day streak/bar charts
7. **ReminderScreen** — daily local notification time + toggle

No account, no server — everything reads/writes through `src/api/client.ts`
(AsyncStorage-backed, despite the `api` name). Any new screen should follow
the same pattern: a `read`/`write` pair against a new `KEYS.*` entry, not a
new storage mechanism.

## Component conventions

- Card = `colors.card` bg, `borderRadius: 16`, `paddingHorizontal: 16` /
  `paddingVertical: 14`, `marginBottom: 10`. See any screen's `styles.card`.
- Checked/removed/active state = green tint background
  (`rgba(143,184,154,0.12)`) + `colors.accentGreen` dot/checkbox fill, not a
  full color swap — keeps the dark theme intact.
- Section captions are `textMuted`, 11-13px, sit above the content they label
  (not inside a bordered box).
- No shadows, no gradients, minimal motion — matches the "calm environment"
  premise. If a screen needs an animation (e.g. streak celebration), keep it
  short and skip it entirely under reduced-motion.

## Review checklist for any new/changed screen

- [ ] Colors only from `theme/colors.ts`
- [ ] Card/spacing values match the conventions above (16 radius, 10 margin,
      14/16 padding) unless there's a stated reason to diverge
- [ ] Works with `userInterfaceStyle: dark` from `app.json` — no light-only
      assumptions
- [ ] New persisted data goes through `src/api/client.ts`'s `KEYS` pattern,
      not a separate ad-hoc storage call
- [ ] Text is in Russian, matching the rest of the app's copy
