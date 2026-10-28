import { describe, expect, it } from "vitest";
import { BADGES } from "./index";
import { explainBadge } from "./explain";

const marked = (slug: string, n: number) => {
  const m = explainBadge(slug, n)!;
  return m.digits.map((d, i) => (m.hit[i] ? `[${d}]` : d)).join("");
};

describe("explainBadge", () => {
  it("highlights just the digit for a 'contains' badge", () => {
    expect(marked("lucky-seven", 357112)).toBe("35[7]112");
  });
  it("highlights every copy when a digit repeats", () => {
    expect(marked("lucky-seven", 770321)).toBe("[7][7]0321");
  });
  it("marks the whole number for whole-number badges", () => {
    expect(explainBadge("mirror", 123321)!.whole).toBe(true);
    expect(marked("mirror", 123321)).toBe("[1][2][3][3][2][1]");
  });
  it("picks one of the pairs for 'two identical digits side by side'", () => {
    const m = marked("double-take", 844889);
    expect(["8[4][4]889", "844[8][8]9"]).toContain(m);
  });
  it("shows the three eights in 'eights galore'", () => {
    expect(marked("eights-galore", 844889)).toBe("[8]44[8][8]9");
  });
  it("returns null for an unknown badge", () => {
    expect(explainBadge("no-such-badge", 5)).toBeNull();
  });
  it("always highlights something for every badge on a number that has it", () => {
    for (const b of BADGES.slice(0, 120)) {
      for (const n of [7, 4242, 123454, 777777, 100000]) {
        if (!b.test(n)) continue;
        const m = explainBadge(b.slug, n)!;
        expect(m.hit.some(Boolean)).toBe(true);
      }
    }
  });
});
