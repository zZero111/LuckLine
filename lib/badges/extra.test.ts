import { describe, expect, it } from "vitest";
import { BADGES, matchBadges } from "./index";
import { aliquot, divisorCount, factorize, isHappy, isPrimeFast, isSelfNumber, sigmaOf, toRoman } from "./numberTheory";
import { isPrime } from "./helpers";

const bySlug = new Map(BADGES.map((b) => [b.slug, b.id]));
const has = (n: number, slug: string) => {
  const id = bySlug.get(slug);
  if (id === undefined) throw new Error(`no badge ${slug}`);
  return matchBadges(n).includes(id);
};

describe("number theory tables", () => {
  it("sieve agrees with trial division", () => {
    for (let n = 0; n < 5000; n++) expect(isPrimeFast(n)).toBe(isPrime(n));
    expect(isPrimeFast(999983)).toBe(true);
    expect(isPrimeFast(1999993)).toBe(true); // used by Sophie Germain checks
  });
  it("divisors and factors", () => {
    expect(factorize(360)).toEqual([[2, 3], [3, 2], [5, 1]]);
    expect(divisorCount(360)).toBe(24);
    expect(sigmaOf(28)).toBe(56);
    expect(aliquot(220)).toBe(284);
    expect(sigmaOf(1_234_567)).toBe(1_234_567 + 1 + 127 + 9721); // above the table
  });
  it("misc", () => {
    expect(isHappy(7)).toBe(true);
    expect(isHappy(4)).toBe(false);
    expect(isSelfNumber(20)).toBe(true);
    expect(isSelfNumber(21)).toBe(false); // 15 + 1 + 5
    expect(toRoman(3888)).toBe("MMMDCCCLXXXVIII");
  });
});

describe("expansion badges", () => {
  it("has 300+ badges with unique slugs and consecutive ids", () => {
    expect(BADGES.length).toBeGreaterThanOrEqual(300);
    expect(new Set(BADGES.map((b) => b.slug)).size).toBe(BADGES.length);
    expect(BADGES.map((b) => b.id)).toEqual(BADGES.map((_, i) => i + 1));
  });
  it("digit runs and counts", () => {
    expect(has(99901, "triple-nines")).toBe(true);
    expect(has(99091, "triple-nines")).toBe(false);
    expect(has(99091, "nines-galore")).toBe(true);
    expect(has(377777, "penta-sevens")).toBe(true);
    expect(has(105500, "zeros-galore")).toBe(true);
  });
  it("exact numbers", () => {
    for (const [n, slug] of [[1729, "taxicab-number"], [142857, "cyclic-number"], [101010, "answer-in-binary"], [21, "blackjack"]] as const) {
      expect(has(n, slug)).toBe(true);
      expect(has(n + 1, slug)).toBe(false);
    }
  });
  it("primes", () => {
    expect(has(11, "sophie-germain")).toBe(true);
    expect(has(23, "safe-prime")).toBe(true);
    expect(has(197, "circular-prime")).toBe(true);
    expect(has(3797, "right-truncatable")).toBe(true);
    expect(has(3797, "left-truncatable")).toBe(true);
    expect(has(131071, "mersenne-prime")).toBe(true);
    expect(has(65537, "fermat-prime")).toBe(true);
  });
  it("sequences and number theory", () => {
    expect(has(3571, "lucas")).toBe(true);
    expect(has(208012, "catalan")).toBe(true);
    expect(has(115975, "bell")).toBe(true);
    expect(has(510510, "primorial")).toBe(true);
    expect(has(720720, "highly-composite")).toBe(true);
    expect(has(220, "amicable")).toBe(true);
    expect(has(284, "amicable")).toBe(true);
    expect(has(297, "kaprekar-number")).toBe(true);
    expect(has(9376, "automorphic")).toBe(true);
    expect(has(22, "smith")).toBe(true);
    expect(has(8712, "reversal-multiple")).toBe(true);
    expect(has(4, "prime-squared")).toBe(true);
    expect(has(30, "sphenic")).toBe(true);
  });
  it("digit games, bases and calendar", () => {
    expect(has(123402, "lucky-ticket")).toBe(true);
    expect(has(123246, "double-up")).toBe(true);
    expect(has(6119, "upside-down")).toBe(true);
    expect(has(1124, "balanced")).toBe(true);
    expect(has(444777, "split-decision")).toBe(true);
    expect(has(0xdead, "hex-dead")).toBe(true);
    expect(has(0xcafe1, "hex-cafe")).toBe(true);
    expect(has(19, "roman-mirror")).toBe(true);
    expect(has(1988, "retro-year")).toBe(true);
    expect(has(2024, "leap-year")).toBe(true);
    expect(has(2359, "clock-face")).toBe(true);
    expect(has(2960, "clock-face")).toBe(false);
    expect(has(2902, "birthday")).toBe(true); // 29 Feb
    expect(has(3002, "birthday")).toBe(false); // 30 Feb
  });
});

describe("replacements for duplicate badges, and the 67 badges", () => {
  it("old duplicate slugs are gone and replacements exist", () => {
    for (const gone of ["penta-zeros", "zeros-takeover", "triple-sixes", "zeros-overload", "make-a-wish", "ninety-nine-problems"]) {
      expect(bySlug.has(gone)).toBe(false);
    }
    for (const slug of ["square-mirror", "digit-factorials", "nine-lives", "mirror-image", "one-step-wonder", "product-power"]) {
      expect(bySlug.has(slug)).toBe(true);
    }
  });
  it("replacement badges", () => {
    expect(has(26, "square-mirror")).toBe(true); // 26^2 = 676
    expect(has(27, "square-mirror")).toBe(false); // 729
    expect(has(145, "digit-factorials")).toBe(true);
    expect(has(40585, "digit-factorials")).toBe(true);
    expect(has(146, "digit-factorials")).toBe(false);
    expect(has(729, "nine-lives")).toBe(true);
    expect(has(730, "nine-lives")).toBe(false);
    expect(has(818, "mirror-image")).toBe(true);
    expect(has(819, "mirror-image")).toBe(false);
    expect(has(29, "one-step-wonder")).toBe(true); // 29 + 92 = 121
    expect(has(11, "one-step-wonder")).toBe(false); // palindromes are excluded
    expect(has(999999, "product-power")).toBe(true);
    expect(has(111111, "product-power")).toBe(false);
  });
  it("67", () => {
    expect(has(167, "six-seven")).toBe(true);
    expect(has(76, "six-seven")).toBe(false);
    expect(has(67, "exactly-sixty-seven")).toBe(true);
    expect(has(167, "exactly-sixty-seven")).toBe(false);
  });
  it("replaced slots keep their ids, new badges go at the end", () => {
    expect(bySlug.get("square-mirror")).toBe(100); // was penta-zeros
    expect(bySlug.get("one-step-wonder")).toBe(246); // was make-a-wish
    expect(BADGES.at(-1)?.slug).toBe("exactly-sixty-seven");
    expect(BADGES.at(-2)?.slug).toBe("six-seven");
  });
});
