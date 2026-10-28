// How the badge album is laid out. The database knows each badge's family (the
// set where only the best badge counts, and the unit you can fuse into a Master
// badge). Families with 2+ badges are sections of their own; single-badge
// families are gathered into a few themed sections so the album stays readable.

const DIGIT_WORD = ["zeros", "ones", "twos", "threes", "fours", "fives", "sixes", "sevens", "eights", "nines"];

const TITLES: Record<string, string> = {
  repeat: "Repeating digits",
  exact: "Exact numbers",
  "multiple-of-prime": "Divisibility",
  prime: "Primes",
  hexspeak: "Hexspeak",
  sevens: "Lucky sevens",
  eights: "Lucky eights",
  opening: "Opening digits",
  ending: "Endings",
  sorted: "Sorted digits",
  round: "Round numbers",
  staircase: "Staircases",
  small: "Digit count",
  "digit-sum-exact": "Magic sums",
  high: "High rollers",
  pi: "Pi",
  year: "Years",
  calculator: "Calculator words",
  "base-palindrome": "Mirrors in other bases",
  roman: "Roman numerals",
  alternating: "Zigzags",
  bits: "Bits",
  clock: "Clocks",
  date: "Dates",
  "digit-range": "Digit range",
  "meme-69": "Nice",
  pairs: "Pairs",
  palindrome: "Palindromes",
  parity: "Odds and evens",
  shape: "Shapes",
};

/** Section title for a family. */
export function familyTitle(family: string): string {
  if (TITLES[family]) return TITLES[family];
  const run = /^run-(\d)$/.exec(family);
  if (run) return `Runs of ${DIGIT_WORD[Number(run[1])]}`;
  const count = /^count-(\d)$/.exec(family);
  if (count) return `Lots of ${DIGIT_WORD[Number(count[1])]}`;
  return family.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export interface AlbumBadge {
  slug: string;
  name: string;
  emoji: string;
  family: string;
  description: string;
  rarity: string;
  ep: number;
}

export interface AlbumSection<B extends AlbumBadge = AlbumBadge> {
  key: string;
  title: string;
  /** The family this section is (so it can be fused), or null for a themed collection. */
  family: string | null;
  badges: B[];
}

/** Families with at least this many badges can be fused. */
export const MIN_FUSION_SIZE = 3;

function collectionFor(family: string): { key: string; title: string } {
  if (family.startsWith("meme-")) return { key: "c-famous", title: "Famous numbers" };
  if (family.startsWith("has-")) return { key: "c-hidden", title: "Hidden patterns" };
  return { key: "c-theory", title: "Number theory" };
}

/** Group the catalogue into album sections; badges within a section go from easiest to hardest. */
export function buildSections<B extends AlbumBadge>(badges: readonly B[]): AlbumSection<B>[] {
  const byFamily = new Map<string, B[]>();
  for (const b of badges) byFamily.set(b.family, [...(byFamily.get(b.family) ?? []), b]);
  const sections = new Map<string, AlbumSection<B>>();
  for (const [family, list] of byFamily) {
    if (list.length >= 2) {
      sections.set(`f-${family}`, { key: `f-${family}`, title: familyTitle(family), family, badges: list });
    } else {
      const c = collectionFor(family);
      const sec = sections.get(c.key) ?? { key: c.key, title: c.title, family: null, badges: [] };
      sec.badges.push(...list);
      sections.set(c.key, sec);
    }
  }
  const out = [...sections.values()];
  for (const sec of out) sec.badges.sort((a, b) => a.ep - b.ep || a.slug.localeCompare(b.slug));
  return out;
}

/** EP for fusing a family of this size (mirrors private.fusion_reward in the database). */
export function fusionReward(size: number): number {
  return Math.min(25000, 500 * size + 2000);
}
