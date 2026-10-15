// Badge catalogue and scoring for Luckline.
//
// Every roll is an integer in [MIN_ROLL, MAX_ROLL]. Each badge is a pure
// predicate over that number. Badges stack: a roll's EP is the sum of the EP
// of every badge it matches. Badge rarity and EP come from how many of the
// 1,000,001 possible numbers match the badge (see rarityFor / epFor), and are
// precomputed into supabase/seed.sql by scripts/precompute.ts.
//
// IDs are stable: never renumber or reuse an id once shipped. Append new
// badges with the next free id.

import {
  MAX_ROLL,
  MIN_ROLL,
  digits,
  isArithmetic,
  isFibonacci,
  isPalindrome,
  isPerfectCube,
  isPerfectSquare,
  isPrime,
  longestRepeat,
  longestStep,
} from "./helpers";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "anomaly" | "mythic";
export type Tier = "trash" | Rarity;

export interface Badge {
  id: number;
  slug: string;
  name: string;
  emoji: string;
  description: string;
  test(n: number): boolean;
}

/** Number of possible rolls (0..1,000,000 inclusive). */
export const TOTAL_NUMBERS = MAX_ROLL - MIN_ROLL + 1;

const s = digits;
const has = (n: number, sub: string) => s(n).includes(sub);
const multipleOf = (n: number, m: number) => n > 0 && n % m === 0;

export const BADGES: readonly Badge[] = [
  { id: 1, slug: "mirror", name: "Mirror", emoji: "🪞", description: "Reads the same forwards and backwards.", test: (n) => isPalindrome(s(n)) },
  { id: 2, slug: "grand-mirror", name: "Grand Mirror", emoji: "🔮", description: "A six-digit number that reads the same both ways.", test: (n) => s(n).length === 6 && isPalindrome(s(n)) },
  { id: 3, slug: "indivisible", name: "Indivisible", emoji: "🧱", description: "A prime: only 1 and itself divide it.", test: (n) => isPrime(n) },
  { id: 4, slug: "triplet", name: "Triplet", emoji: "🎲", description: "The same digit three times in a row.", test: (n) => longestRepeat(s(n)) >= 3 },
  { id: 5, slug: "quartet", name: "Quartet", emoji: "🎻", description: "The same digit four times in a row.", test: (n) => longestRepeat(s(n)) >= 4 },
  { id: 6, slug: "quintet", name: "Quintet", emoji: "🖐️", description: "The same digit five times in a row.", test: (n) => longestRepeat(s(n)) >= 5 },
  { id: 7, slug: "monochrome", name: "Monochrome", emoji: "⬛", description: "Two or more digits, every one identical.", test: (n) => s(n).length >= 2 && longestRepeat(s(n)) === s(n).length },
  { id: 8, slug: "tidy-hundred", name: "Tidy Hundred", emoji: "💯", description: "A positive multiple of 100.", test: (n) => multipleOf(n, 100) },
  { id: 9, slug: "clean-thousand", name: "Clean Thousand", emoji: "🧼", description: "A positive multiple of 1,000.", test: (n) => multipleOf(n, 1_000) },
  { id: 10, slug: "spotless-ten-k", name: "Spotless Ten-K", emoji: "✨", description: "A positive multiple of 10,000.", test: (n) => multipleOf(n, 10_000) },
  { id: 11, slug: "pristine-hundred-k", name: "Pristine Hundred-K", emoji: "💎", description: "A positive multiple of 100,000.", test: (n) => multipleOf(n, 100_000) },
  { id: 12, slug: "nice", name: "Nice", emoji: "😏", description: "Contains 69 somewhere in its digits.", test: (n) => has(n, "69") },
  { id: 13, slug: "four-twenty", name: "Four Twenty", emoji: "🌿", description: "Contains 420 somewhere in its digits.", test: (n) => has(n, "420") },
  { id: 14, slug: "elite-speak", name: "Elite Speak", emoji: "👾", description: "Contains 1337, the hacker's favourite.", test: (n) => has(n, "1337") },
  { id: 15, slug: "calculator-joke", name: "Calculator Joke", emoji: "🧮", description: "Contains 8008. Turn it upside down.", test: (n) => has(n, "8008") },
  { id: 16, slug: "slot-machine", name: "Slot Machine", emoji: "🎰", description: "Contains 777: three sevens line up.", test: (n) => has(n, "777") },
  { id: 17, slug: "beastly", name: "Beastly", emoji: "😈", description: "Contains 666.", test: (n) => has(n, "666") },
  { id: 18, slug: "slice-of-pi", name: "Slice of Pi", emoji: "🥧", description: "Starts with 3141, the opening digits of pi.", test: (n) => s(n).startsWith("3141") },
  { id: 19, slug: "the-answer", name: "The Answer", emoji: "🌌", description: "Exactly 42.", test: (n) => n === 42 },
  { id: 20, slug: "staircase-up", name: "Staircase Up", emoji: "📈", description: "Four or more digits climbing by one (like 3456).", test: (n) => longestStep(s(n), 1) >= 4 },
  { id: 21, slug: "staircase-down", name: "Staircase Down", emoji: "📉", description: "Four or more digits falling by one (like 8765).", test: (n) => longestStep(s(n), -1) >= 4 },
  { id: 22, slug: "even-stride", name: "Even Stride", emoji: "📏", description: "Three or more digits forming one steady progression (like 2468).", test: (n) => isArithmetic(s(n)) },
  { id: 23, slug: "square-deal", name: "Square Deal", emoji: "🟩", description: "A perfect square.", test: (n) => n > 0 && isPerfectSquare(n) },
  { id: 24, slug: "cubed", name: "Cubed", emoji: "🧊", description: "A perfect cube.", test: (n) => n > 0 && isPerfectCube(n) },
  { id: 25, slug: "golden-spiral", name: "Golden Spiral", emoji: "🐚", description: "A Fibonacci number.", test: (n) => n > 0 && isFibonacci(n) },
  { id: 26, slug: "doubling", name: "Doubling", emoji: "💾", description: "A power of two.", test: (n) => n > 0 && (n & (n - 1)) === 0 },
  { id: 27, slug: "void", name: "Void", emoji: "🕳️", description: "Exactly zero. Nothing at all.", test: (n) => n === 0 },
  { id: 28, slug: "the-million", name: "The Million", emoji: "🏆", description: "Exactly 1,000,000, the highest roll there is.", test: (n) => n === MAX_ROLL },
  { id: 29, slug: "lucky-seven", name: "Lucky Seven", emoji: "🍀", description: "Has at least one 7 in it.", test: (n) => has(n, "7") },
  { id: 30, slug: "double-take", name: "Double Take", emoji: "👀", description: "Two identical digits side by side.", test: (n) => longestRepeat(s(n)) >= 2 },
];

// ---------------------------------------------------------------------------
// Rarity and EP
// ---------------------------------------------------------------------------

/** Lower-exclusive probability bounds: a badge is `rarity` when p > bound (checked in order). */
export const RARITY_THRESHOLDS: readonly (readonly [Rarity, number])[] = [
  ["common", 0.1],
  ["uncommon", 0.01],
  ["rare", 0.001],
  ["epic", 0.0001],
  ["anomaly", 0.00001],
];

/** common p>0.10, uncommon 0.01<p<=0.10, rare 0.001<p<=0.01, epic 0.0001<p<=0.001, anomaly 0.00001<p<=0.0001, mythic p<=0.00001. */
export function rarityFor(p: number): Rarity {
  for (const [rarity, bound] of RARITY_THRESHOLDS) if (p > bound) return rarity;
  return "mythic";
}

/** EP = max(1, round(10 * log2(1/p))). */
export function epFor(p: number): number {
  return Math.max(1, Math.round(10 * Math.log2(1 / p)));
}

export interface BadgeStat {
  badge: Badge;
  count: number;
  probability: number;
  rarity: Rarity;
  ep: number;
}

/** Badge ids matched by n, ascending. */
export function matchBadges(n: number): number[] {
  const ids: number[] = [];
  for (const b of BADGES) if (b.test(n)) ids.push(b.id);
  return ids;
}

/** Full scan of 0..MAX_ROLL. Returns per-badge stats and each number's badge ids. */
export function computeBadgeStats(): { stats: BadgeStat[]; matches: number[][] } {
  const counts = new Map<number, number>(BADGES.map((b) => [b.id, 0]));
  const matches: number[][] = new Array(TOTAL_NUMBERS);
  for (let n = MIN_ROLL; n <= MAX_ROLL; n++) {
    const ids = matchBadges(n);
    for (const id of ids) counts.set(id, counts.get(id)! + 1);
    matches[n - MIN_ROLL] = ids;
  }
  const stats = BADGES.map((badge) => {
    const count = counts.get(badge.id)!;
    const probability = count / TOTAL_NUMBERS;
    return { badge, count, probability, rarity: rarityFor(probability), ep: epFor(probability) };
  });
  return { stats, matches };
}

let epCache: Map<number, number> | null = null;

/** EP per badge id. Computed lazily with one full scan (about a second) and cached. */
export function badgeEpMap(): Map<number, number> {
  if (!epCache) {
    epCache = new Map(computeBadgeStats().stats.map((st) => [st.badge.id, st.ep]));
  }
  return epCache;
}

/** Score one roll: matched badge ids and the summed EP. */
export function scoreNumber(n: number, epById: Map<number, number> = badgeEpMap()): { badgeIds: number[]; ep: number } {
  const badgeIds = matchBadges(n);
  let ep = 0;
  for (const id of badgeIds) ep += epById.get(id)!;
  return { badgeIds, ep };
}

// ---------------------------------------------------------------------------
// Overall tier of a number
// ---------------------------------------------------------------------------
//
// A number's tier depends on where its total EP ranks among all 1,000,001
// numbers. Let
//   atOrAbove = share of numbers with EP >= this number's EP
//   atOrBelow = share of numbers with EP <= this number's EP
// Then, checked in order:
//   mythic   atOrAbove <= 1%
//   anomaly  atOrAbove <= 5%
//   epic     atOrAbove <= 10%
//   rare     atOrAbove <= 25%
//   uncommon atOrAbove <= 50%
//   trash    atOrBelow <= 1%
//   common   otherwise
// Equal EP always means equal tier, so ties are never split; a tie group that
// straddles a cutoff falls to the lower tier. (Using "share strictly above"
// instead would rank the huge EP-0 group as rare, since only ~25% of numbers
// beat it.) Trash is the bottom 1% only when the lowest-EP group itself is
// within 1%; with this catalogue the EP-0 group is far bigger, so in practice
// no number is trash.

export const TIER_CUTOFFS = {
  mythic: 0.01,
  anomaly: 0.05,
  epic: 0.1,
  rare: 0.25,
  uncommon: 0.5,
  trash: 0.01,
} as const;

export function tierFromShares(atOrAbove: number, atOrBelow: number): Tier {
  if (atOrAbove <= TIER_CUTOFFS.mythic) return "mythic";
  if (atOrAbove <= TIER_CUTOFFS.anomaly) return "anomaly";
  if (atOrAbove <= TIER_CUTOFFS.epic) return "epic";
  if (atOrAbove <= TIER_CUTOFFS.rare) return "rare";
  if (atOrAbove <= TIER_CUTOFFS.uncommon) return "uncommon";
  if (atOrBelow <= TIER_CUTOFFS.trash) return "trash";
  return "common";
}

/** Map every distinct EP value in `eps` to its tier. */
export function tiersForEps(eps: ArrayLike<number>): Map<number, Tier> {
  const hist = new Map<number, number>();
  for (let i = 0; i < eps.length; i++) hist.set(eps[i], (hist.get(eps[i]) ?? 0) + 1);
  const values = [...hist.keys()].sort((a, b) => a - b);
  const total = eps.length;
  const out = new Map<number, Tier>();
  let below = 0;
  for (const v of values) {
    const c = hist.get(v)!;
    out.set(v, tierFromShares((total - below) / total, (below + c) / total));
    below += c;
  }
  return out;
}
