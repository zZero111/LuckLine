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
}

export function formatNumber(n: number) {
  return n.toLocaleString("en-US");
}
