// Aura recipes for badges: how big, what colour and which visual effects.
// Everything is derived from the badge's rarity and slug, so each badge always
// looks the same, and similar badges share a theme.

import { TIER_COLOR, tierRank, type TierName } from "./tiers";

export type AuraKind =
  | "ripple" // rings expanding outward
  | "sparkle" // twinkling four-point stars
  | "orbit" // a bright comet circling the border
  | "embers" // glowing sparks rising up
  | "lightning" // crackling bolts along the edges
  | "prism" // a rainbow border and a sweeping shine
  | "void" // a dark vortex
  | "gold" // gold glints falling, with a golden sheen
  | "code"; // green characters raining down

export type AuraTheme = "fire" | "void" | "code" | "gold" | "cosmic" | "electric" | null;

export interface AuraSpec {
  /** 1 (common) … 6 (mythic). */
  rank: number;
  color: string;
  theme: AuraTheme;
  kinds: AuraKind[];
  /** How far the glow reaches past the card, in px. */
  size: number;
  /** Glow strength 0..1. */
  alpha: number;
  /** Hue shift in degrees, so unthemed badges of one rarity still differ. */
  hue: number;
  /** Seed for particle positions. */
  seed: number;
  /** Particle multiplier for the rarity (and for quieter placements). */
  count: number;
}

const SIZE = [0, 10, 16, 26, 38, 52, 72];
const ALPHA = [0, 0.3, 0.42, 0.55, 0.68, 0.82, 1];

const THEMES: [Exclude<AuraTheme, null>, RegExp, string][] = [
  ["fire", /beast|666|blaz|420|twenty|hell|inferno|emergency|911|devil|fire|flame/, "#fb923c"],
  ["void", /void|nothing|hollow|zero|dead|black|empty/, "#a855f7"],
  ["code", /hex-|binary|elite|eleet|leet|code|calc|byte|port-|two-to|bits|doubling|1337|8080|65535|65536|31337|ascii/, "#22c55e"],
  ["gold", /million|grand|jackpot|golden|fortune|blackjack|slot|lucky-strike|lucky-opener|century|price|tidy|clean|spotless|pristine|money|top-shelf|high-roller/, "#facc15"],
  ["cosmic", /(^|-)pi($|-)|euler|e-exact|spiral|ratio|root|moon|space|odyssey|light|cyclic|answer|deep|orbit|star|fibonacci|mersenne|fermat|sophie|taxicab|perfect|kaprekar|catalan|bell|lucas/, "#818cf8"],
  ["electric", /zigzag|ping|sawtooth|speed|zap|thunder|checker|lucky-ticket|storm|surge/, "#67e8f9"],
];

const THEME_KIND: Record<Exclude<AuraTheme, null>, AuraKind> = {
  fire: "embers",
  void: "void",
  code: "code",
  gold: "gold",
  cosmic: "sparkle",
  electric: "lightning",
};

const GENERIC: AuraKind[][] = [
  [],
  [], // common: just the glow
  ["ripple"],
  ["sparkle"],
  ["orbit", "sparkle"],
  ["lightning", "sparkle", "orbit"],
  ["prism", "lightning", "sparkle"],
];

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** Deterministic 0..1 generator. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The aura for a badge. `intensity` (0..1) tones it down for busy lists. */
export function auraFor(slug: string, rarity: string, intensity = 1): AuraSpec {
  const rank = Math.min(6, Math.max(1, tierRank(rarity)));
  const seed = hashString(slug);
  const found = THEMES.find(([, re]) => re.test(slug));
  const theme: AuraTheme = rank >= 2 && found ? found[0] : null;
  let color = TIER_COLOR[rarity as TierName] ?? TIER_COLOR.common;
  let kinds: AuraKind[];
  if (theme && found) {
    color = found[2];
    kinds = [THEME_KIND[theme]];
    if (rank >= 4 && theme !== "electric") kinds.push("sparkle");
    if (rank >= 5) kinds.push("orbit");
    if (rank >= 6) kinds.push("prism", "lightning");
  } else {
    kinds = [...GENERIC[rank]];
  }
  if (intensity < 0.7) kinds = kinds.slice(0, 2);
  return {
    rank,
    color,
    theme,
    kinds: Array.from(new Set(kinds)),
    size: Math.round(SIZE[rank] * intensity),
    alpha: ALPHA[rank] * (0.55 + 0.45 * intensity),
    hue: theme ? 0 : (seed % 50) - 25,
    seed,
    count: (0.45 + rank / 6) * (0.5 + 0.5 * intensity),
  };
}
