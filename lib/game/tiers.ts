// Display metadata for roll tiers and badge rarities (same scale, plus "trash").

export const TIER_ORDER = ["trash", "common", "uncommon", "rare", "epic", "anomaly", "mythic"] as const;
export type TierName = (typeof TIER_ORDER)[number];

/** 0 = trash … 6 = mythic. Unknown values rank as common. */
export function tierRank(t: string): number {
  const i = TIER_ORDER.indexOf(t as TierName);
  return i < 0 ? 1 : i;
}

/** Accent colour per tier, used for glows and confetti. */
export const TIER_COLOR: Record<TierName, string> = {
  trash: "#78716c",
  common: "#a1a1aa",
  uncommon: "#34d399",
  rare: "#38bdf8",
  epic: "#a78bfa",
  anomaly: "#fbbf24",
  mythic: "#fb7185",
};

export function tierColor(t: string): string {
  return TIER_COLOR[t as TierName] ?? TIER_COLOR.common;
}

/** Emoji square per tier/rarity for the share text. */
export const TIER_SQUARE: Record<TierName, string> = {
  trash: "⬛",
  common: "⬜",
  uncommon: "🟩",
  rare: "🟦",
  epic: "🟪",
  anomaly: "🟨",
  mythic: "🟥",
};

export function tierSquare(t: string): string {
  return TIER_SQUARE[t as TierName] ?? TIER_SQUARE.common;
}

/** Short hype line shown under the tier when it lands. */
export const TIER_HYPE: Record<TierName, string> = {
  trash: "Ouch. Tomorrow is another roll.",
  common: "A roll like most rolls.",
  uncommon: "A little bit of luck.",
  rare: "Nice pull!",
  epic: "Now we're talking!",
  anomaly: "Something strange is going on…",
  mythic: "LEGENDARY. Screenshot this.",
};

export function tierHype(t: string): string {
  return TIER_HYPE[t as TierName] ?? TIER_HYPE.common;
}
