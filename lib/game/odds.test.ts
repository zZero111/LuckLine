import { describe, expect, it } from "vitest";
import stats from "@/lib/badges/stats.json";
import { badgeOneIn, countAtLeast, percentileLine, shareBelow } from "./odds";
import { tierRank, tierSquare } from "./tiers";

describe("odds", () => {
  it("gives exact 1-in-N odds from badge counts", () => {
    expect(badgeOneIn("the-answer")).toBe(1_000_001); // exactly 42
    expect(badgeOneIn("indivisible")).toBe(Math.round(1_000_001 / 78_498));
    expect(badgeOneIn("not-a-badge")).toBeNull();
  });

  it("counts every number at EP 0", () => {
    expect(countAtLeast(0)).toBe(stats.total);
    expect(shareBelow(0)).toBe(0);
  });

  it("is monotonic over the EP distribution", () => {
    let prev = Infinity;
    for (const [ep, n] of stats.epAtLeast as [number, number][]) {
      expect(countAtLeast(ep)).toBe(n);
      expect(n).toBeLessThan(prev);
      prev = n;
    }
  });

  it("treats an EP between known values as strictly above it", () => {
    const [[e0], [e1, n1]] = stats.epAtLeast as [number, number][];
    if (e1 - e0 > 1) expect(countAtLeast(e0 + 1)).toBe(n1);
  });

  it("writes readable percentile lines", () => {
    expect(percentileLine(0)).toBe("The most common kind of roll there is");
    const top = (stats.epAtLeast as [number, number][]).at(-1)![0];
    expect(percentileLine(top)).toMatch(/^Top .*% of all possible rolls$/);
  });
});

describe("tiers", () => {
  it("ranks and colours tiers", () => {
    expect(tierRank("trash")).toBe(0);
    expect(tierRank("mythic")).toBe(6);
    expect(tierRank("???")).toBe(1);
    expect(tierSquare("rare")).toBe("🟦");
  });
});
