export interface RollBadge {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  rarity: string;
  ep: number;
}

export interface RollResultData {
  roll_date: string;
  number: number;
  ep: number;
  tier: string;
  badges: RollBadge[];
  /** 0 = the daily roll, 1.. = paid rerolls. */
  attempt?: number;
  /** Returned by roll_today / reroll_today: wallet balance after this roll. */
  balance?: number;
  /** The number's own score, before any Lucky Wheel effect. */
  base_ep?: number;
  multiplier?: number;
  bonus_ep?: number;
  /** reroll_today: true when this reroll used a free reroll from the wheel. */
  free?: boolean;
}

export interface WheelPrize {
  id: number;
  slug: string;
  label: string;
  kind: "nothing" | "multiplier" | "bonus" | "free_reroll";
  value: number;
  weight: number;
  color: string;
  sort: number;
}

/** Today's spin, as stored. */
export interface WheelSpin {
  prize_id: number;
  attempt: number;
  ep_before: number;
  ep_after: number;
  free_reroll_used: boolean;
}

/** "×3", "×0.5", "+50", "×2 +50" or "" for an unmodified roll. */
export function wheelTag(multiplier?: number | null, bonus?: number | null) {
  const parts: string[] = [];
  if (multiplier != null && Number(multiplier) !== 1) parts.push(`×${Number(multiplier)}`);
  if (bonus) parts.push(`+${formatNumber(bonus)}`);
  return parts.join(" ");
}

export function rollLabel(attempt: number | undefined) {
  return attempt ? `Reroll ${attempt}` : "Daily roll";
}

export function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}
