import { describe, expect, it } from "vitest";
import { BADGES, epFor, matchBadges, rarityFor, scoreNumber, tierFromShares, tiersForEps } from "./index";

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
    expect(matchBadges(182635)).toEqual([]);
    expect(scoreNumber(182635, new Map()).ep).toBe(0);
  });
  it("scoreNumber sums badge EP", () => {
    const ep = new Map(BADGES.map((b) => [b.id, b.id * 10]));
    const r = scoreNumber(1337, ep);
    expect(r.ep).toBe(r.badgeIds.reduce((t, id) => t + id * 10, 0));
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
  it("EP formula", () => {
    expect(epFor(1)).toBe(1);
    expect(epFor(0.5)).toBe(10);
    expect(epFor(0.25)).toBe(20);
    expect(epFor(0.001)).toBe(100);
    expect(epFor(1 / 1_000_001)).toBe(199);
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
