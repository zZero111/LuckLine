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
}

export function rollLabel(attempt: number | undefined) {
  return attempt ? `Reroll ${attempt}` : "Daily roll";
}

export function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}
