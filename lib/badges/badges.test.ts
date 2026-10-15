import { describe, expect, it } from "vitest";
import stats from "./stats.json";
import { BADGES, TOTAL_NUMBERS, bestPerFamily, epFor, matchBadges, rarityFor, scoreNumber, tierFromShares, tiersForEps } from "./index";

// Real EP per badge, from the generated stats (fast: no full scan).
const counts = stats.badgeCounts as Record<string, number>;
const realEp = new Map(BADGES.map((b) => [b.id, epFor(counts[b.slug] / TOTAL_NUMBERS)]));
const bySlug = new Map(BADGES.map((b) => [b.slug, b.id]));

const slugsOf = (n: number) => {
  const ids = new Set(matchBadges(n));
  return BADGES.filter((b) => ids.has(b.id)).map((b) => b.slug);
};

describe("catalogue", () => {
  it("has unique, stable-looking ids and valid unique slugs", () => {
    const ids = BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(ids.map((_, i) => i + 1));
    const slugs = BADGES.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]{1,40}$/);
  });
});

describe("badge tests", () => {
  it("123456 climbs", () => expect(slugsOf(123456)).toContain("staircase-up"));
  it("654321 falls", () => expect(slugsOf(654321)).toContain("staircase-down"));
  it("777777 is all-same and repeats", () => {
    expect(slugsOf(777777)).toEqual(
      expect.arrayContaining(["monochrome", "triplet", "quartet", "quintet", "grand-mirror", "slot-machine", "lucky-seven"]),
    );
  });
  it("1000000 is round and the max", () => {
    expect(slugsOf(1_000_000)).toEqual(
      expect.arrayContaining(["the-million", "tidy-hundred", "clean-thousand", "spotless-ten-k", "pristine-hundred-k", "square-deal", "cubed"]),
    );
  });
  it("2 and 7 are prime, 1 and 9 are not", () => {
    expect(slugsOf(2)).toContain("indivisible");
    expect(slugsOf(7)).toContain("indivisible");
    expect(slugsOf(1)).not.toContain("indivisible");
    expect(slugsOf(9)).not.toContain("indivisible");
  });
  it("memes", () => {
    expect(slugsOf(1337)).toContain("elite-speak");
    expect(slugsOf(420)).toContain("four-twenty");
    expect(slugsOf(6969)).toContain("nice");
    expect(slugsOf(58008)).toContain("calculator-joke");
    expect(slugsOf(314159)).toContain("slice-of-pi");
    expect(slugsOf(42)).toContain("the-answer");
  });
  it("12321 is a palindrome but not a six-digit one", () => {
    expect(slugsOf(12321)).toContain("mirror");
    expect(slugsOf(12321)).not.toContain("grand-mirror");
    expect(slugsOf(123321)).toContain("grand-mirror");
  });
  it("0 is the void and nothing round", () => {
    expect(slugsOf(0)).toContain("void");
    expect(slugsOf(0)).not.toContain("tidy-hundred");
  });
  it("misc maths", () => {
    expect(slugsOf(13579)).toContain("even-stride");
    expect(slugsOf(1024)).toContain("doubling");
    expect(slugsOf(832040)).toContain("golden-spiral");
    expect(slugsOf(1000)).toContain("cubed");
  });
  it("a plain number gets nothing", () => {
    expect(matchBadges(102062)).toEqual([]);
    expect(scoreNumber(102062, new Map()).ep).toBe(0);
  });
  it("scoreNumber sums badge EP", () => {
    const ep = new Map(BADGES.map((b) => [b.id, b.id * 10]));
    const r = scoreNumber(1337, ep);
    expect(r.ep).toBe(r.badgeIds.reduce((t, id) => t + id * 10, 0));
  });
});

describe("families", () => {
  it("every badge has a family slug", () => {
    for (const b of BADGES) expect(b.family).toMatch(/^[a-z0-9-]{1,40}$/);
  });
  it("only the best badge per family counts", () => {
    // 77777: double-take, triplet, quartet, quintet and monochrome all match; monochrome wins.
    const ids = scoreNumber(77777, realEp).badgeIds;
    expect(ids).toContain(bySlug.get("monochrome"));
    for (const slug of ["double-take", "triplet", "quartet", "quintet"]) expect(ids).not.toContain(bySlug.get(slug));
    // Different families still stack.
    expect(ids).toContain(bySlug.get("jackpot"));
  });
  it("ties in a family keep the lowest id", () => {
    const ep = new Map(BADGES.map((b) => [b.id, 1]));
    const pal = BADGES.filter((b) => b.family === "palindrome").map((b) => b.id);
    expect(bestPerFamily(pal, ep)).toEqual([Math.min(...pal)]);
  });
  it("EP of a roll is the sum of its counted badges", () => {
    for (const n of [0, 42, 1337, 123456, 777777, 1_000_000]) {
      const r = scoreNumber(n, realEp);
      expect(r.ep).toBe(r.badgeIds.reduce((t, id) => t + realEp.get(id)!, 0));
    }
  });
  it("stats.json is in sync with the catalogue (run npm run precompute)", () => {
    expect(Object.keys(counts).sort()).toEqual(BADGES.map((b) => b.slug).sort());
    for (const b of BADGES) expect(counts[b.slug]).toBeGreaterThan(0);
  });
});

describe("new badges", () => {
  const has = (n: number, slug: string) => matchBadges(n).includes(bySlug.get(slug)!);
  it("maths", () => {
    expect(has(153, "narcissist")).toBe(true);
    expect(has(8128, "perfect")).toBe(true);
    expect(has(46656, "sixth-power")).toBe(true);
    expect(has(729, "tripling")).toBe(true);
    expect(has(40320, "factorial")).toBe(true);
    expect(has(10301, "prime-mirror")).toBe(true);
    expect(has(13, "emirp")).toBe(true);
    expect(has(11, "emirp")).toBe(false);
    expect(has(41, "twin-prime")).toBe(true);
  });
  it("shapes and digits", () => {
    expect(has(13862, "mountain")).toBe(true);
    expect(has(85148, "valley")).toBe(true);
    expect(has(121212, "ping-pong")).toBe(true);
    expect(has(418418, "copycat")).toBe(true);
    expect(has(777377, "odd-one-out")).toBe(true);
    expect(has(110011, "binary")).toBe(true);
    expect(has(456789, "full-flight")).toBe(true);
  });
  it("dates and times", () => {
    expect(has(311299, "date-stamp")).toBe(true);
    expect(has(310299, "date-stamp")).toBe(false); // 31 Feb
    expect(has(235959, "clockwork")).toBe(true);
    expect(has(246000, "clockwork")).toBe(false);
  });
  it("memes and constants", () => {
    expect(has(9001, "over-nine-thousand")).toBe(true);
    expect(has(314159, "perfect-pi")).toBe(true);
    expect(has(271828, "eulers-number")).toBe(true);
    expect(has(161803, "golden-ratio")).toBe(true);
    expect(has(140404, "not-found")).toBe(true);
  });
});

describe("rarity and EP", () => {
  it("rarity thresholds", () => {
    expect(rarityFor(0.5)).toBe("common");
    expect(rarityFor(0.1)).toBe("uncommon");
    expect(rarityFor(0.0101)).toBe("uncommon");
    expect(rarityFor(0.01)).toBe("rare");
    expect(rarityFor(0.001)).toBe("epic");
    expect(rarityFor(0.0001)).toBe("anomaly");
    expect(rarityFor(0.00002)).toBe("anomaly");
    expect(rarityFor(0.00001)).toBe("mythic");
    expect(rarityFor(1 / 1_000_001)).toBe("mythic");
  });
  it("EP formula: EP is the 1-in-N odds", () => {
    expect(epFor(1)).toBe(1);
    expect(epFor(0.5)).toBe(2);
    expect(epFor(0.25)).toBe(4);
    expect(epFor(0.001)).toBe(1000);
    expect(epFor(1 / 1_000_001)).toBe(1_000_001);
  });
});

describe("tiers", () => {
  it("cutoffs", () => {
    expect(tierFromShares(0.01, 1)).toBe("mythic");
    expect(tierFromShares(0.05, 1)).toBe("anomaly");
    expect(tierFromShares(0.1, 1)).toBe("epic");
    expect(tierFromShares(0.25, 1)).toBe("rare");
    expect(tierFromShares(0.5, 1)).toBe("uncommon");
    expect(tierFromShares(0.9, 0.5)).toBe("common");
    expect(tierFromShares(1, 0.01)).toBe("trash");
  });
  it("ranks a distribution and never splits ties", () => {
    // 100 numbers: EP 0..99 once each -> top 1 mythic, bottom 1 trash.
    const t = tiersForEps(Array.from({ length: 100 }, (_, i) => i));
    expect(t.get(99)).toBe("mythic");
    expect(t.get(95)).toBe("anomaly");
    expect(t.get(94)).toBe("epic");
    expect(t.get(75)).toBe("rare");
    expect(t.get(50)).toBe("uncommon");
    expect(t.get(49)).toBe("common");
    expect(t.get(0)).toBe("trash");
    // A big EP-0 group is common, not trash.
    const big = tiersForEps([0, 0, 0, 0, 0, 0, 0, 0, 0, 5]);
    expect(big.get(0)).toBe("common");
  });
});
