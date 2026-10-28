// Works out which digits of a roll earned a badge, for the "why did I get this?"
// breakdown. Badges are plain yes/no tests on the number, so instead of
// describing each one by hand we ask the test itself: which digits must stay
// as they are for the badge to survive whatever the other digits become?

import { BADGES } from "./index";
import { MAX_ROLL } from "./helpers";

export interface DigitMatch {
  /** The number's digits, left to right (no padding zeros). */
  digits: string[];
  /** true for the digits that earned the badge. */
  hit: boolean[];
  /** True when the whole number is what counts (a prime, a palindrome, a digit sum ...). */
  whole: boolean;
}

const BY_SLUG = new Map(BADGES.map((b) => [b.slug, b]));
const SAMPLES = 48;

/** Small deterministic generator, so a number always gets the same breakdown. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Does the badge still hold for many different values of the digits at `free`? */
function survives(test: (n: number) => boolean, chars: string[], free: ReadonlySet<number>, rand: () => number): boolean {
  for (let k = 0; k < SAMPLES; k++) {
    const next = chars.slice();
    for (const i of free) {
      // First two samples: all zeros / all nines, the rest random.
      next[i] = k === 0 ? "0" : k === 1 ? "9" : String(Math.floor(rand() * 10));
    }
    if (next.length > 1 && next[0] === "0") continue; // would change the number's length
    if (!test(Number(next.join("")))) return false;
  }
  return true;
}

/** Which digits of `n` earned the badge `slug`, or null for an unknown badge. */
export function explainBadge(slug: string, n: number): DigitMatch | null {
  const badge = BY_SLUG.get(slug);
  if (!badge) return null;
  const chars = String(n).split("");
  const all = (hit: boolean) => ({ digits: chars, hit: chars.map(() => hit), whole: true });
  if (n > MAX_ROLL / 10 && chars.length > 6) return all(true);

  // Start with every digit "needed", then free up each digit in turn if the badge
  // still holds however it (and the digits freed before it) change.
  const rand = rng(n * 31 + slug.length);
  const free = new Set<number>();
  for (let i = 0; i < chars.length; i++) {
    free.add(i);
    if (!survives(badge.test, chars, free, rand)) free.delete(i);
  }
  const hit = chars.map((_, i) => !free.has(i));
  // A single digit earned it ("contains a 7"): light up every copy of it.
  if (hit.filter(Boolean).length === 1) {
    const v = chars[hit.indexOf(true)];
    chars.forEach((c, i) => {
      if (c === v) hit[i] = true;
    });
  }
  // Nothing needed (a six-digit number, say) or everything needed (a prime): the whole number.
  const whole = !hit.some(Boolean) || hit.every(Boolean);
  return { digits: chars, hit: whole ? chars.map(() => true) : hit, whole };
}
