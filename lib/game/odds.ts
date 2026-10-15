// Badge odds and roll percentiles from lib/badges/stats.json, which
// scripts/precompute.ts generates from the same scoring as the database.
import stats from "@/lib/badges/stats.json";

const TOTAL: number = stats.total;
const COUNTS: Record<string, number> = stats.badgeCounts;
const EP_AT_LEAST = stats.epAtLeast as [number, number][];

/** "1 in N" odds for a badge, or null if the slug is unknown. */
export function badgeOneIn(slug: string): number | null {
  const c = COUNTS[slug];
  return c ? Math.max(1, Math.round(TOTAL / c)) : null;
}

/** How many of the 1,000,001 numbers score at least `ep`. */
export function countAtLeast(ep: number): number {
  let lo = 0;
  let hi = EP_AT_LEAST.length - 1;
  let ans = 0;
  // Last entry whose EP <= ep: numbers scoring >= ep are those at that entry.
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (EP_AT_LEAST[mid][0] <= ep) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  const [foundEp, count] = EP_AT_LEAST[ans];
  if (foundEp === ep) return count;
  // ep falls between known values: count numbers strictly above it.
  return ans + 1 < EP_AT_LEAST.length ? EP_AT_LEAST[ans + 1][1] : 0;
}

/** Share (0..1) of all possible rolls that score strictly less than `ep`. */
export function shareBelow(ep: number): number {
  return 1 - countAtLeast(ep) / TOTAL;
}

/** Human line like "Better than 87.3% of all possible rolls" or "Top 0.04% of all rolls". */
export function percentileLine(ep: number): string {
  const top = countAtLeast(ep) / TOTAL;
  if (top <= 0.05) {
    const pct = top * 100;
    return `Top ${pct < 0.01 ? pct.toPrecision(2) : pct.toFixed(2)}% of all possible rolls`;
  }
  const below = shareBelow(ep) * 100;
  if (below < 0.05) return "The most common kind of roll there is";
  return `Better than ${below.toFixed(1)}% of all possible rolls`;
}

export function formatOdds(n: number): string {
  return `1 in ${n.toLocaleString("en-US")}`;
}
