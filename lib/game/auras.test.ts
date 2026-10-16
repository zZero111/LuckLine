import { describe, expect, it } from "vitest";
import { auraFor, hashString, seeded } from "./auras";

describe("badge auras", () => {
  it("get bigger, stronger and busier with rarity", () => {
    const rarities = ["common", "uncommon", "rare", "epic", "anomaly", "mythic"];
    const specs = rarities.map((r) => auraFor("some-plain-badge", r));
    for (let i = 1; i < specs.length; i++) {
      expect(specs[i].size).toBeGreaterThan(specs[i - 1].size);
      expect(specs[i].alpha).toBeGreaterThan(specs[i - 1].alpha);
      expect(specs[i].kinds.length).toBeGreaterThanOrEqual(specs[i - 1].kinds.length);
    }
    expect(specs[0].kinds).toEqual([]); // commons only glow
    expect(specs[5].kinds).toEqual(expect.arrayContaining(["prism", "lightning", "sparkle"]));
  });

  it("are the same every time for one badge, different between badges", () => {
    expect(auraFor("alpha", "rare")).toEqual(auraFor("alpha", "rare"));
    expect(auraFor("alpha", "rare").seed).not.toBe(auraFor("beta", "rare").seed);
    const hues = new Set(["a", "b", "c", "d", "e", "f"].map((s) => auraFor(s, "epic").hue));
    expect(hues.size).toBeGreaterThan(1);
  });

  it("choose a theme from what the badge is", () => {
    expect(auraFor("beastly", "rare").theme).toBe("fire");
    expect(auraFor("four-twenty", "rare").theme).toBe("fire");
    expect(auraFor("hex-dead", "anomaly").theme).toBe("void"); // "dead" wins over hex
    expect(auraFor("hex-cafe", "anomaly").theme).toBe("code");
    expect(auraFor("the-million", "mythic").theme).toBe("gold");
    expect(auraFor("perfect-pi", "mythic").theme).toBe("cosmic");
    expect(auraFor("void", "mythic").theme).toBe("void");
    expect(auraFor("zigzag", "uncommon").theme).toBe("electric");
    expect(auraFor("plain-thing", "rare").theme).toBeNull();
  });

  it("keep commons simple even if the name sounds themed", () => {
    const s = auraFor("beastly", "common");
    expect(s.theme).toBeNull();
    expect(s.kinds).toEqual([]);
  });

  it("themed mythics stack the big effects on top of their theme", () => {
    const s = auraFor("the-million", "mythic");
    expect(s.kinds).toEqual(expect.arrayContaining(["gold", "orbit", "prism", "lightning"]));
  });

  it("tone down for busy lists", () => {
    const full = auraFor("perfect-pi", "mythic", 1);
    const soft = auraFor("perfect-pi", "mythic", 0.5);
    expect(soft.size).toBeLessThan(full.size);
    expect(soft.alpha).toBeLessThan(full.alpha);
    expect(soft.kinds.length).toBeLessThanOrEqual(2);
  });
});

describe("seeded random", () => {
  it("is deterministic and in range", () => {
    const a = seeded(hashString("x"));
    const b = seeded(hashString("x"));
    for (let i = 0; i < 20; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
