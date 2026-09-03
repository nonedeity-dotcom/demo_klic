import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import type { PhaseId } from "../lib/phase";
import { colors, phaseColors, withAlpha } from "../theme/colors";

/**
 * A small drawing for each stretch of the road: a sprout, a whirlpool, a road out of the
 * mountains at sunrise, a rocket.
 *
 * Vector rather than four bitmaps on purpose. They are tinted from `phaseColors` instead of
 * carrying their own baked-in palette, they cost nothing in the APK, and they stay sharp at
 * both sizes they are used at — 110pt inside the streak ring, 84pt on the Этапы cards.
 *
 * Everything is drawn in a 100×100 box and clipped to a disc whose edge fades out, so it
 * sits on the tinted Этапы card as happily as on the report's darker one. Shapes are
 * deliberately simple: at 84pt across, detail turns to mud.
 */
export default function PhaseArt({
  id,
  size,
  dim,
}: {
  id: PhaseId;
  size: number;
  /**
   * Darkens part of the drawing where something is printed on top of it. Over a lit sun or
   * a rocket's exhaust the digits were unreadable, and a flat panel behind them would cut a
   * visible straight edge across the disc — this fades instead.
   */
  dim?: "bottom" | "center";
}) {
  const tint = phaseColors[id];
  // Gradient ids share one document on web, where four of these render side by side on the
  // Этапы screen — without the phase in the name every disc would draw the first one's glow.
  const glowId = `phase-glow-${id}`;
  const discId = `phase-disc-${id}`;
  const scrimId = `phase-scrim-${id}`;
  const centreScrimId = `phase-scrim-centre-${id}`;
  const clipId = `phase-clip-${id}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        {/* The dark ground, faded to nothing at the rim so the disc has no hard edge. */}
        <RadialGradient id={discId} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.bg} stopOpacity="0.95" />
          <Stop offset="0.82" stopColor={colors.bg} stopOpacity="0.92" />
          <Stop offset="1" stopColor={colors.bg} stopOpacity="0" />
        </RadialGradient>
        {/* Light on the subject, gone by the rim. */}
        <RadialGradient id={glowId} cx="50%" cy="55%" r="55%">
          <Stop offset="0" stopColor={tint} stopOpacity="0.26" />
          <Stop offset="0.55" stopColor={tint} stopOpacity="0.08" />
          <Stop offset="1" stopColor={tint} stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id={scrimId} x1="0" y1="0.4" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.bg} stopOpacity="0" />
          <Stop offset="1" stopColor={colors.bg} stopOpacity="0.88" />
        </LinearGradient>
        {/* Fades out well before the rim, so the drawing stays visible around the number. */}
        <RadialGradient id={centreScrimId} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.bg} stopOpacity="0.82" />
          <Stop offset="0.34" stopColor={colors.bg} stopOpacity="0.6" />
          <Stop offset="0.62" stopColor={colors.bg} stopOpacity="0" />
        </RadialGradient>
        <ClipPath id={clipId}>
          <Circle cx="50" cy="50" r="50" />
        </ClipPath>
      </Defs>

      <Circle cx="50" cy="50" r="50" fill={`url(#${discId})`} />
      <Circle cx="50" cy="50" r="50" fill={`url(#${glowId})`} />

      {/* Clipped, so a mountain range or an exhaust cloud drawn past the edge stays a disc
          rather than filling the corners of the box. */}
      <G clipPath={`url(#${clipId})`}>
        {id === "honeymoon" && <Sprout tint={tint} />}
        {id === "dip" && <Whirlpool tint={tint} />}
        {id === "plateau" && <Sunrise tint={tint} />}
        {id === "autopilot" && <Rocket tint={tint} />}
        {dim === "bottom" && <Rect x="0" y="40" width="100" height="60" fill={`url(#${scrimId})`} />}
        {dim === "center" && <Circle cx="50" cy="50" r="50" fill={`url(#${centreScrimId})`} />}
      </G>
    </Svg>
  );
}

/** Two leaves out of a mound: the smallest possible "it has started". */
function Sprout({ tint }: { tint: string }) {
  return (
    <G>
      <Path d="M2 92 Q28 64 50 64 Q72 64 98 92 Z" fill={withAlpha(tint, 0.22)} />
      <Path d="M18 92 Q38 72 50 72 Q62 72 82 92 Z" fill={withAlpha(tint, 0.4)} />
      <Path d="M50 72 L50 44" stroke={tint} strokeWidth="3" strokeLinecap="round" />
      {/* Two leaves, mirrored: one curving out, one curving back. */}
      <Path d="M50 52 Q34 50 30 36 Q46 34 50 52 Z" fill={tint} />
      <Path d="M50 48 Q66 44 70 30 Q54 29 50 48 Z" fill={tint} opacity="0.85" />
      <Circle cx="26" cy="26" r="2" fill={tint} opacity="0.6" />
      <Circle cx="76" cy="48" r="1.6" fill={tint} opacity="0.5" />
      <Circle cx="62" cy="18" r="1.6" fill={tint} opacity="0.45" />
    </G>
  );
}

/** A spiral pulling inwards, going dark at the middle — the shape of the phase it names. */
function Whirlpool({ tint }: { tint: string }) {
  return (
    <G>
      {/* Three copies of one true spiral, a third of a revolution apart. A computed polyline
          rather than hand-written curves: overlapping hand-drawn arcs read as a scribble. */}
      {[0, 120, 240].map((angle, i) => (
        <Path
          key={angle}
          d={SPIRAL}
          fill="none"
          stroke={tint}
          strokeWidth={3 - i * 0.6}
          strokeLinecap="round"
          opacity={0.7 - i * 0.18}
          transform={`rotate(${angle} 50 50)`}
        />
      ))}
      {/* The eye of it: nothing, which is the point. */}
      <Circle cx="50" cy="50" r="11" fill={colors.bg} />
      <Circle cx="50" cy="50" r="11" fill={withAlpha(tint, 0.1)} />
      {/* Debris caught in the pull. */}
      <Path d="M16 34 l6 -3 3 6 -6 3 Z" fill={tint} opacity="0.5" />
      <Path d="M80 62 l6 -3 3 6 -6 3 Z" fill={tint} opacity="0.4" />
      <Path d="M68 16 l5 -2 2 5 -5 2 Z" fill={tint} opacity="0.3" />
    </G>
  );
}

/** An Archimedean spiral, 2.6 turns from r=8 to r=42, sampled as a polyline. */
const SPIRAL = "M58.0 50.0 L58.2 51.0 L58.3 52.0 L58.2 53.0 L58.0 54.0 L57.7 55.1 L57.2 56.1 L56.6 57.1 L55.9 58.0 L55.1 58.8 L54.1 59.6 L53.0 60.2 L51.9 60.8 L50.6 61.1 L49.3 61.4 L47.9 61.5 L46.5 61.4 L45.1 61.1 L43.8 60.7 L42.4 60.1 L41.1 59.3 L39.9 58.4 L38.8 57.3 L37.8 56.0 L37.0 54.6 L36.3 53.1 L35.8 51.5 L35.4 49.9 L35.3 48.1 L35.4 46.4 L35.7 44.6 L36.2 42.9 L36.9 41.2 L37.8 39.6 L39.0 38.0 L40.3 36.7 L41.8 35.4 L43.5 34.3 L45.3 33.4 L47.2 32.8 L49.2 32.3 L51.3 32.1 L53.4 32.1 L55.5 32.4 L57.7 33.0 L59.7 33.8 L61.7 34.8 L63.5 36.1 L65.3 37.6 L66.8 39.3 L68.1 41.3 L69.3 43.4 L70.2 45.6 L70.8 47.9 L71.1 50.4 L71.2 52.9 L70.9 55.4 L70.4 57.9 L69.5 60.3 L68.4 62.6 L67.0 64.9 L65.3 66.9 L63.4 68.8 L61.2 70.4 L58.9 71.8 L56.3 72.9 L53.7 73.7 L50.9 74.3 L48.0 74.4 L45.1 74.3 L42.3 73.8 L39.5 72.9 L36.7 71.8 L34.1 70.3 L31.7 68.4 L29.5 66.3 L27.5 64.0 L25.8 61.4 L24.5 58.6 L23.4 55.6 L22.7 52.5 L22.3 49.3 L22.4 46.0 L22.8 42.8 L23.6 39.5 L24.8 36.4 L26.3 33.4 L28.2 30.6 L30.5 28.1 L33.0 25.7 L35.9 23.7 L38.9 22.0 L42.2 20.7 L45.6 19.7 L49.2 19.2 L52.8 19.1 L56.4 19.4 L60.0 20.1 L63.5 21.2 L66.9 22.8 L70.1 24.8 L73.1 27.1 L75.8 29.8 L78.2 32.8 L80.2 36.1 L81.9 39.6 L83.1 43.4 L83.9 47.3 L84.2 51.2 L84.1 55.2 L83.5 59.2 L82.4 63.2 L80.8 67.0 L78.9 70.6 L76.4 74.0 L73.6 77.1 L70.5 79.8 L67.0 82.2 L63.2 84.2 L59.2 85.7 L55.0 86.8 L50.7 87.4 L46.3 87.4 L41.9 87.0 L37.6 86.0 L33.4 84.6 L29.3 82.6 L25.5 80.1 L22.0 77.3 L18.8 74.0 L16.0 70.3 L13.7 66.3 L11.8 62.0 L10.4 57.6 L9.6 52.9 L9.3 48.2 L9.5 43.4 L10.3 38.7 L11.7 34.0 L13.6 29.6 L16.0 25.3";

/** Sun up over the ridge, with the road already going somewhere. */
function Sunrise({ tint }: { tint: string }) {
  // Each ridge is drawn twice — an opaque dark silhouette, then the tint on top. A single
  // translucent fill let the sun shine through the mountains, which put it in front of them.
  const ridgeFar = "M-4 54 L18 32 L36 50 L56 28 L78 52 L104 38 L104 104 L-4 104 Z";
  const ridgeNear = "M-4 68 L24 46 L46 66 L68 44 L104 72 L104 104 L-4 104 Z";
  return (
    <G>
      <Circle cx="50" cy="40" r="26" fill={tint} opacity="0.14" />
      <Circle cx="50" cy="40" r="14" fill={tint} opacity="0.95" />

      <Path d={ridgeFar} fill={colors.bg} />
      <Path d={ridgeFar} fill={withAlpha(tint, 0.34)} />
      <Path d={ridgeNear} fill={colors.bg} />
      <Path d={ridgeNear} fill={withAlpha(tint, 0.16)} />

      {/* The road as a ribbon, not a line: narrow where it leaves the ridge, wide where it
          reaches the viewer. A stroke of constant width read as a stray squiggle. */}
      <Path d="M49 66 C45 78 46 90 38 104 L62 104 C55 90 55 78 51 66 Z" fill={tint} opacity="0.85" />
    </G>
  );
}

/** Off the ground and climbing — the stretch where it keeps going without being pushed. */
function Rocket({ tint }: { tint: string }) {
  return (
    <G>
      <Circle cx="24" cy="22" r="1.8" fill={tint} opacity="0.7" />
      <Circle cx="76" cy="30" r="1.5" fill={tint} opacity="0.55" />
      <Circle cx="68" cy="14" r="1.2" fill={tint} opacity="0.45" />
      <Circle cx="18" cy="46" r="1.2" fill={tint} opacity="0.4" />
      {/* Body: a nose cone drawn as two curves meeting at the top. */}
      <Path d="M50 10 C60 22 64 36 62 52 L38 52 C36 36 40 22 50 10 Z" fill={tint} />
      <Path d="M38 52 C34 48 30 52 28 60 L38 58 Z" fill={tint} opacity="0.7" />
      <Path d="M62 52 C66 48 70 52 72 60 L62 58 Z" fill={tint} opacity="0.7" />
      <Circle cx="50" cy="30" r="6" fill={colors.bg} />
      <Circle cx="50" cy="30" r="3.4" fill={tint} opacity="0.55" />
      <Path d="M44 54 Q50 72 56 54 Q50 62 44 54 Z" fill={tint} opacity="0.9" />
      {/* Exhaust, loose ellipses so it reads as a puff rather than a solid block. */}
      <Ellipse cx="38" cy="84" rx="14" ry="9" fill={withAlpha(tint, 0.35)} />
      <Ellipse cx="60" cy="86" rx="16" ry="10" fill={withAlpha(tint, 0.28)} />
      <Ellipse cx="49" cy="78" rx="11" ry="8" fill={withAlpha(tint, 0.22)} />
    </G>
  );
}
